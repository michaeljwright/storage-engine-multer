import { Bucket, Storage } from "@google-cloud/storage";
import multer from "multer";
import path from "path";

import GcsUpload from "./gcsUpload";

type constructorOptions = {
  projectId: string;
  keyFilename: string;
  bucketName: string;
};

class GoogleCloudStorageService {
  public projectId: string;
  public keyFilename: string;
  public bucketName: string;
  public storage: Storage;
  public bucket: Bucket;

  constructor(opts: constructorOptions) {
    this.projectId = opts.projectId;
    this.keyFilename = opts.keyFilename;
    this.bucketName = opts.bucketName;
    this.storage = new Storage({
      projectId: this.projectId,
      keyFilename: path.resolve(__dirname, "../", this.keyFilename)
    });
    this.bucket = this.storage.bucket(this.bucketName);
  }

  readFiles = async (folder: string, luxId: string) => {
    let fileList: { name: string; created: Date; updated: Date }[] = [];
    const [files] = await this.bucket.getFiles({ prefix: folder });

    files.forEach(file => {
      if (file.name.includes(luxId)) {
        fileList.push({
          name: file.name,
          created: file.metadata.timeCreated,
          updated: file.metadata.updated
        });
      }
    });

    return fileList;
  };

  mergeFiles = async (mergeOptions: any) => {
    return mergeOptions;
  };

  uploadMiddleware = () => {
    const gcStorageUpload = GcsUpload({
      bucket: this.bucket
    });

    return multer({
      storage: gcStorageUpload
    }).single("file");
  };
}

export default (opts: constructorOptions) => {
  return new GoogleCloudStorageService(opts);
};
