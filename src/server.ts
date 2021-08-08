import express, { Request, Response } from "express";
import GcsService from "./middleware/gcsService";

const app = express();
app.use(express.json());

const gcsServiceProvider = GcsService({
  projectId: "mike-test-01",
  keyFilename: "service-account.json",
  bucketName: "gcp-bucket-test001"
});

app.get("/read", async (_req: Request, res: Response) => {
  let bucketFiles = await gcsServiceProvider.readFiles("", "LUX50001");

  res.send(bucketFiles);
});

app.post(
  "/upload",
  gcsServiceProvider.uploadMiddleware(),
  (_req: Request, res: Response) => {
    _req.on("co", (data: any) => {
      console.log(data);
    });

    if (!_req.file) {
      res.redirect("/error");
    } else {
      res.send(_req.file);
    }
  }
);

app.get("/error", async (_req: Request, res: Response) => {
  let err = { message: "An error has occurred." };

  res.send(err);
});

app.listen(5000, () => console.log("Server started on port 5000"));
