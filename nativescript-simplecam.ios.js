"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var types = require("utils/types");
var imageAssetModule = require("image-asset");
var trace = require("trace");
var listener;
var SimpleCamDelegateImpl = NSObject.extend({
  simpleCamNotAuthorizedForCameraUse: function(simpleCam) {
    if (this.callback) {
      this.callback(null);
    }
    simpleCam.closeWithCompletion(function() {
      listener = null;
    });
  },
  simpleCamDidFinishWithImage: function(simpleCam, image) {
    if (image) {
      var imageSource = require("image-source");
      var imageSourceResult = imageSource.fromNativeSource(image);
      if (this.callback) {
        var imageAsset = new imageAssetModule.ImageAsset(imageSourceResult.ios);
        imageAsset.options = {
          width: this.width,
          height: this.height,
          keepAspectRatio: this.keepAspectRatio
        };
        this.callback(imageAsset);
      }
    }
    simpleCam.closeWithCompletion(function() {
      listener = null;
    });
  }
}, {
  name: 'SimpleCamDelegateImpl',
  protocols: [SimpleCamDelegate]
});
SimpleCamDelegateImpl.initWithCallbackAndOptions = function (callback, options) {
  var delegate = SimpleCamDelegateImpl.new();
  delegate.callback = callback;
  if (options) {
    delegate.width = options.width;
    delegate.height = options.height;
    delegate.keepAspectRatio = types.isNullOrUndefined(options.keepAspectRatio) ? true : options.keepAspectRatio;
  }
  return delegate
}

exports.takePicture = function (options) {
  return new Promise(function (resolve, reject) {
    listener = null;
    var simpleCam = SimpleCam.new();
    var reqWidth = 0;
    var reqHeight = 0;
    var keepAspectRatio = true;
    var delegateOption = null;
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
    var frame = require("ui/frame");
    var topMostFrame = frame.topmost();
    if (topMostFrame) {
      var viewController = topMostFrame.currentPage && topMostFrame.currentPage.ios;
      if (viewController) {
        viewController.presentViewControllerAnimatedCompletion(simpleCam, true, null);
      }
    }
  });
};
exports.isAvailable = function () {
  return AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo) != null;
};
exports.requestPermissions = function () {
  var authStatus = AVCaptureDevice.authorizationStatusForMediaType(AVMediaTypeVideo);
  if (authStatus === 0) {
    AVCaptureDevice.requestAccessForMediaTypeCompletionHandler(AVMediaTypeVideo, function (granted) {
      if (granted) {
        if (trace.isEnabled()) {
          trace.write("Application can access AVCaptureDevice.", trace.categories.Debug);
        }
        return;
      }
    });
  }
  else if (authStatus !== 3) {
    if (trace.isEnabled()) {
      trace.write("Application can not access AVCaptureDevice.", trace.categories.Debug);
    }
  }
};
