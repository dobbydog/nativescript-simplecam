/// <reference path="./node_modules/tns-platform-declarations/ios.d.ts" />
import * as types from "tns-core-modules/utils/types";
import { ImageAsset } from "tns-core-modules/image-asset";
import * as imageSource from "tns-core-modules/image-source";
import * as trace from "tns-core-modules/trace";
import * as frame from "tns-core-modules/ui/frame";
import { CameraOptions } from "./nativescript-simplecam";

declare class SimpleCamDelegate {
  callback: (image: ImageAsset) => void;
  width: number;
  height: number;
  keepAspectRatio: boolean;
  simpleCamNotAuthorizedForCameraUse(simpleCam: SimpleCam): void;
  simpleCamDidFinishWithImage(simpleCam: SimpleCam, image?: UIImage): void;
  simpleCamDidCaptureImage?(simplecam: SimpleCam, image?: UIImage): void;
  simpleCamDidLoadCameraIntoView?(simplecam: SimpleCam): void;
}

declare class SimpleCam extends UIViewController {
  static new(): SimpleCam;
  delegate?: SimpleCamDelegate;
  closeWithCompletion(completion: () => void): void;
}

let listener: SimpleCamDelegateImpl;

class SimpleCamDelegateImpl extends NSObject implements SimpleCamDelegate {
  static ObjCProtocols = [SimpleCamDelegate];

  callback: (image: ImageAsset) => void;
  width: number;
  height: number;
  keepAspectRatio: boolean;

  static initWithCallbackAndOptions(callback: (image: ImageAsset) => void, options: CameraOptions): SimpleCamDelegateImpl {
    const delegate = SimpleCamDelegateImpl.new() as SimpleCamDelegateImpl;
    delegate.callback = callback;
    if (options) {
      delegate.width = options.width;
      delegate.height = options.height;
      delegate.keepAspectRatio = types.isNullOrUndefined(options.keepAspectRatio) ? true : options.keepAspectRatio;
    }
    return delegate;
  }

  simpleCamNotAuthorizedForCameraUse(simpleCam: SimpleCam): void {
    if (this.callback) {
      this.callback(null);
    }
    simpleCam.closeWithCompletion(() => {
      listener = null;
    });
  }

  simpleCamDidFinishWithImage(simpleCam: SimpleCam, image?: UIImage): void {
    if (image) {
      const imageSourceResult = imageSource.fromNativeSource(image);
      if (this.callback) {
        const imageAsset = new ImageAsset(imageSourceResult.ios);
        imageAsset.options = {
          width: this.width,
          height: this.height,
          keepAspectRatio: this.keepAspectRatio,
        };
        this.callback(imageAsset);
      }
    }
    simpleCam.closeWithCompletion(() => {
      listener = null;
    });
  }
}

export function takePicture(options: CameraOptions): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    listener = null;
    const simpleCam = SimpleCam.new();
    let reqWidth = 0;
    let reqHeight = 0;
    let keepAspectRatio = true;
    let delegateOption: CameraOptions = null;
    if (options) {
      reqWidth = options.width || 0;
      reqHeight = options.height || reqWidth;
      keepAspectRatio = types.isNullOrUndefined(options.keepAspectRatio) ? true : options.keepAspectRatio;
    }
    if (reqWidth && reqHeight) {
      delegateOption = { width: reqWidth, height: reqHeight, keepAspectRatio: keepAspectRatio };
    }
    listener = SimpleCamDelegateImpl.initWithCallbackAndOptions(resolve, delegateOption);
    simpleCam.delegate = listener;
    const topMostFrame = frame.topmost();
    if (topMostFrame) {
      const viewController = topMostFrame.currentPage && topMostFrame.currentPage.ios;
      if (viewController) {
        viewController.presentViewControllerAnimatedCompletion(simpleCam, true, null);
      }
    }
  });
}

export function isAvailable(): boolean {
  return AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo) != null;
}

export function requestPermissions(): Promise<any> {
  return new Promise((resolve, reject) => {
    const authStatus = AVCaptureDevice.authorizationStatusForMediaType(AVMediaTypeVideo);
    if (authStatus === 0) {
      AVCaptureDevice.requestAccessForMediaTypeCompletionHandler(AVMediaTypeVideo, granted => {
        if (granted) {
          if (trace.isEnabled()) {
            trace.write("Application can access AVCaptureDevice.", trace.categories.Debug);
          }
          return resolve();
        }
      });
    } else if (authStatus !== 3) {
      if (trace.isEnabled()) {
        trace.write("Application can not access AVCaptureDevice.", trace.categories.Debug);
      }
      return reject();
    }

    return resolve();
  });
}
