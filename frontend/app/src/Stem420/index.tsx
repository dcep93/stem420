import CryptoJS from "crypto-js";
import { useState } from "react";
import recorded_sha from "./recorded_sha";

const BUCKET_NAME = "stem420-bucket";

async function computeMd5(file: File) {
  const functionName = "computeMd5";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    return CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);
  } catch (error) {
    throw new Error(formatErrorMessage(functionName, error));
  }
}

function formatErrorMessage(functionName: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `[${functionName}] ${message}`;
}

export default function Stem420() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isBusy = isUploading || isDeleting;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    const functionName = "handleUpload";

    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    const steps: string[] = [];

    const recordStep = (description: string) => {
      steps.push(description);
    };

    try {
      recordStep("Constructing MD5 checksum");
      const md5Hash = await computeMd5(file);
      recordStep("Checking for existing file in GCS");
      const objectPath = `_stem420/${md5Hash}/input/${file.name}`;
      recordStep(objectPath);
      const encodedPath = encodeURIComponent(objectPath);
      const metadataUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o/${encodedPath}`;

      const metadataResponse = await fetch(metadataUrl);

      if (metadataResponse.ok) {
        recordStep("File already exists in bucket");
        recordStep(objectPath);

        alert(steps.join(", "));
        return;
      }

      if (metadataResponse.status !== 404) {
        throw new Error(
          `Unexpected response when checking object: ${metadataResponse.status}`
        );
      }

      recordStep("Uploading file to GCS");
      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodedPath}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      recordStep("Upload complete");

      alert(steps.join(", "));
    } catch (error) {
      const formattedMessage = formatErrorMessage(functionName, error);
      const stepDetails = steps.join(", ");
      const alertMessage = stepDetails
        ? `${stepDetails}, Failure: ${formattedMessage}`
        : `Failure: ${formattedMessage}`;

      console.error(formattedMessage, error);
      alert(alertMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    const functionName = "handleDeleteAll";
    const steps: string[] = [];

    const recordStep = (description: string) => {
      steps.push(description);
    };

    if (!window.confirm("Delete all files from the GCS bucket?")) {
      return;
    }

    setIsDeleting(true);

    try {
      recordStep("Fetching object list");
      let pageToken: string | undefined;
      const objectNames: string[] = [];

      do {
        const listUrl = new URL(
          `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o`
        );

        if (pageToken) {
          listUrl.searchParams.set("pageToken", pageToken);
        }

        const listResponse = await fetch(listUrl.toString());

        if (!listResponse.ok) {
          throw new Error(
            `Failed to list objects: ${listResponse.status} ${listResponse.statusText}`
          );
        }

        const listData = (await listResponse.json()) as {
          items?: { name: string }[];
          nextPageToken?: string;
        };

        const names = listData.items?.map((item) => item.name) ?? [];
        objectNames.push(...names);
        pageToken = listData.nextPageToken;
      } while (pageToken);

      if (objectNames.length === 0) {
        recordStep("Bucket is already empty");
        alert(steps.join(", "));
        return;
      }

      recordStep(`Deleting ${objectNames.length} object(s)`);

      for (const objectName of objectNames) {
        const encodedName = encodeURIComponent(objectName);
        const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o/${encodedName}`;
        const deleteResponse = await fetch(deleteUrl, { method: "DELETE" });

        if (!deleteResponse.ok) {
          throw new Error(
            `Failed to delete ${objectName}: ${deleteResponse.status} ${deleteResponse.statusText}`
          );
        }
      }

      recordStep("Deletion complete");
      alert(steps.join(", "));
    } catch (error) {
      const formattedMessage = formatErrorMessage(functionName, error);
      const stepDetails = steps.join(", ");
      const alertMessage = stepDetails
        ? `${stepDetails}, Failure: ${formattedMessage}`
        : `Failure: ${formattedMessage}`;

      console.error(formattedMessage, error);
      alert(alertMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div>testing123 {recorded_sha}</div>
      <div style={{ marginTop: "1rem" }}>
        <input type="file" onChange={handleFileChange} disabled={isBusy} />
        <button
          onClick={handleUpload}
          disabled={isBusy}
          style={{ marginLeft: "0.5rem" }}
        >
          {isUploading ? "Uploading..." : "Upload to GCS"}
        </button>
        <button
          onClick={handleDeleteAll}
          disabled={isBusy}
          style={{ marginLeft: "0.5rem" }}
        >
          {isDeleting ? "Deleting..." : "Delete All GCS Files"}
        </button>
      </div>
    </div>
  );
}
