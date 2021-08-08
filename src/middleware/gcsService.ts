import { Bucket, Storage } from "@google-cloud/storage";
import { PDFDocument } from "pdf-lib";
import multer from "multer";
import path from "path";
import fetch from "cross-fetch";
import fs from "fs";

import GcsUpload from "./gcsUpload";

type constructorOptions = {
  projectId: string;
  keyFilename: string;
  bucketName: string;
};

type mergeOptions = {
  folder: string;
  entityUid: string;
  luxId: string;
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

  mergeFiles = async (opts: mergeOptions) => {
    let saveLocally: boolean = false;
    let fileList: { name: string; created: Date; updated: Date }[] = [];
    const mergedPdf = await PDFDocument.create();
    const [files] = await this.bucket.getFiles({ prefix: opts.folder });

    console.log(`entityUid: ${opts.entityUid}`);

    for (let file of files) {
      if (file.name.includes(opts.luxId)) {
        fileList.push({
          name: file.name,
          created: file.metadata.timeCreated,
          updated: file.metadata.updated
        });

        const [url] = await this.bucket.file(file.name).getSignedUrl({
          version: "v2",
          action: "read",
          expires: Date.now() + 1000 * 60 * 9 // 9 minutes
        }); //generate signed url

        const arrayBuffer: ArrayBuffer = await fetch(url).then(res =>
          res.arrayBuffer()
        );

        const pdf = await PDFDocument.load(arrayBuffer);

        for (let idx of pdf.getPageIndices()) {
          const [copiedPage] = await mergedPdf.copyPages(pdf, [idx]);
          mergedPdf.addPage(copiedPage);
        }
      }
    }

    const mergedPdfFile = await mergedPdf.save(); // { addDefaultPage: false }
    const mergedPdfFileName = `mergedfile_${Date.now()}_${opts.luxId}.pdf`;

    if (saveLocally) {
      fs.writeFileSync(`temp/${mergedPdfFileName}`, Buffer.from(mergedPdfFile));
    }

    // save to GCP bucket
    const outputFile = this.bucket.file(mergedPdfFileName);
    await outputFile.save(Buffer.from(mergedPdfFile));

    return fileList;
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
