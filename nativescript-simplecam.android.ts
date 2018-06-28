/// <reference path="./node_modules/tns-platform-declarations/android.d.ts" />
import { android as androidApp } from "tns-core-modules/application";
import * as trace from "tns-core-modules/trace/trace";
import * as platform from "tns-core-modules/platform/platform";
import * as permissions from "nativescript-permissions";
import { CameraOptions } from "./nativescript-simplecam";
import { layout, ad } from "tns-core-modules/utils/utils";
import { isNullOrUndefined } from "tns-core-modules/utils/types";
import { ImageAsset } from "tns-core-modules/image-asset/image-asset";

const REQUEST_IMAGE_CAPTURE = 3453;
const REQUEST_REQUIRED_PERMISSIONS = 1234;

export function takePicture(options?: CameraOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      if ((<any>android.support.v4.content.ContextCompat).checkSelfPermission(
        androidApp.currentContext,
        (<any>android).Manifest.permission.CAMERA) !== android.content.pm.PackageManager.PERMISSION_GRANTED) {

        reject(new Error("Application does not have permissions to use Camera"));

        return;
      }

      let saveToGallery = true;
      let reqWidth = 0;
      let reqHeight = 0;
      let shouldKeepAspectRatio = true;

      const density = layout.getDisplayDensity();
      if (options) {
        saveToGallery = isNullOrUndefined(options.saveToGallery) ? saveToGallery : options.saveToGallery;
        reqWidth = options.width ? options.width * density : reqWidth;
        reqHeight = options.height ? options.height * density : reqWidth;
        shouldKeepAspectRatio = isNullOrUndefined(options.keepAspectRatio) ? shouldKeepAspectRatio : options.keepAspectRatio;
      }

      if ((<any>android.support.v4.content.ContextCompat).checkSelfPermission(
        androidApp.currentContext,
        (<any>android).Manifest.permission.WRITE_EXTERNAL_STORAGE) !== android.content.pm.PackageManager.PERMISSION_GRANTED) {

        saveToGallery = false;
      }

      const takePictureIntent = new android.content.Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
      const dateStamp = createDateTimeStamp();

      let picturePath: string;
      let nativeFile;
      let tempPictureUri;

      if (saveToGallery) {
        picturePath = android.os.Environment.getExternalStoragePublicDirectory(
          android.os.Environment.DIRECTORY_DCIM).getAbsolutePath() + "/Camera/" + "NSIMG_" + dateStamp + ".jpg";

        nativeFile = new java.io.File(picturePath);
      } else {
        picturePath = ad.getApplicationContext().getExternalFilesDir(null).getAbsolutePath() + "/" + "NSIMG_" + dateStamp + ".jpg";
        nativeFile = new java.io.File(picturePath);
      }

      const sdkVersionInt = parseInt(platform.device.sdkVersion);
      if (sdkVersionInt >= 21) {
        tempPictureUri = (<any>android.support.v4.content).FileProvider.getUriForFile(
          androidApp.currentContext,
          androidApp.nativeApp.getPackageName() + ".provider", nativeFile);
      }
      else {
        tempPictureUri = android.net.Uri.fromFile(nativeFile);
      }

      takePictureIntent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, tempPictureUri);

      if (options && options.cameraFacing === "front") {
        takePictureIntent.putExtra("android.intent.extras.CAMERA_FACING",
          android.hardware.Camera.CameraInfo.CAMERA_FACING_FRONT);
      } else {
        takePictureIntent.putExtra("android.intent.extras.CAMERA_FACING",
          android.hardware.Camera.CameraInfo.CAMERA_FACING_BACK);
      }

      if (takePictureIntent.resolveActivity(ad.getApplicationContext().getPackageManager()) != null) {

        // Remove previous listeners if any
        androidApp.off("activityResult");

        androidApp.on("activityResult", (args) => {
          const requestCode = args.requestCode;
          const resultCode = args.resultCode;

          if (requestCode === REQUEST_IMAGE_CAPTURE && resultCode === android.app.Activity.RESULT_OK) {
            if (saveToGallery) {
              try {
                const callback = new android.media.MediaScannerConnection.OnScanCompletedListener({
                  onScanCompleted: function (path, uri) {
                    if (trace.isEnabled()) {
                      trace.write(`image from path ${path} has been successfully scanned!`, trace.categories.Debug);
                    }
                  },
                });

                android.media.MediaScannerConnection.scanFile(androidApp.context, [picturePath], null, callback);
              } catch (ex) {
                if (trace.isEnabled()) {
                  trace.write(`An error occurred while scanning file ${picturePath}: ${ex.message}!`,
                    trace.categories.Debug);
                }
              }
            }

            const exif = new android.media.ExifInterface(picturePath);
            const orientation = exif.getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION,
              android.media.ExifInterface.ORIENTATION_NORMAL);

            if (orientation === android.media.ExifInterface.ORIENTATION_ROTATE_90) {
              rotateBitmap(picturePath, 90);
            } else if (orientation === android.media.ExifInterface.ORIENTATION_ROTATE_180) {
              rotateBitmap(picturePath, 180);
            } else if (orientation === android.media.ExifInterface.ORIENTATION_ROTATE_270) {
              rotateBitmap(picturePath, 270);
            }

            const asset = new ImageAsset(picturePath);
            asset.options = {
              width: reqWidth,
              height: reqHeight,
              keepAspectRatio: shouldKeepAspectRatio,
            };
            resolve(asset);
          } else if (resultCode === android.app.Activity.RESULT_CANCELED) {
            // User cancelled the image capture
            reject(new Error("cancelled"));
          }
        });

        androidApp.foregroundActivity.startActivityForResult(takePictureIntent, REQUEST_IMAGE_CAPTURE);

      }
    } catch (e) {
      if (reject) {
        reject(e);
      }
    }
  });
}

export function isAvailable(): boolean {
  return ad
    .getApplicationContext()
    .getPackageManager()
    .hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA);
}

export function requestPermissions(): Promise<any> {
  return permissions.requestPermissions([
    (<any>android).Manifest.permission.WRITE_EXTERNAL_STORAGE,
    (<any>android).Manifest.permission.CAMERA,
  ]);
}

function createDateTimeStamp(): string {
  let result = "";
  const date = new Date();
  result = date.getFullYear().toString() +
    ((date.getMonth() + 1) < 10 ? "0" + (date.getMonth() + 1).toString() : (date.getMonth() + 1).toString()) +
    (date.getDate() < 10 ? "0" + date.getDate().toString() : date.getDate().toString()) + "_" +
    date.getHours().toString() +
    date.getMinutes().toString() +
    date.getSeconds().toString();

  return result;
}

function rotateBitmap(picturePath: string, angle: number) {
  try {
    const matrix = new android.graphics.Matrix();
    matrix.postRotate(angle);
    const bmOptions = new android.graphics.BitmapFactory.Options();
    const oldBitmap = android.graphics.BitmapFactory.decodeFile(picturePath, bmOptions);
    const finalBitmap = android.graphics.Bitmap.createBitmap(
      oldBitmap, 0, 0, oldBitmap.getWidth(), oldBitmap.getHeight(), matrix, true);
    const out = new java.io.FileOutputStream(picturePath);
    finalBitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 100, out);
    out.flush();
    out.close();
  } catch (ex) {
    if (trace.isEnabled()) {
      trace.write(`An error occurred while rotating file ${picturePath} (using the original one): ${ex.message}!`,
        trace.categories.Debug);
    }
  }
}