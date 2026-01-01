type UploadControlsProps = {
  isBusy: boolean;
  isDeleting: boolean;
  isUploading: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => Promise<void> | void;
  onDeleteAll: () => Promise<void> | void;
};

export default function UploadControls({
  isBusy,
  isDeleting,
  isUploading,
  onFileChange,
  onUpload,
  onDeleteAll,
}: UploadControlsProps) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <input type="file" onChange={onFileChange} disabled={isBusy} />
      <button
        onClick={onUpload}
        disabled={isBusy}
        style={{ marginLeft: "0.5rem" }}
      >
        {isUploading ? "Uploading..." : "Upload to GCS"}
      </button>
      <button
        onClick={onDeleteAll}
        disabled={isBusy}
        style={{ marginLeft: "0.5rem" }}
      >
        {isDeleting ? "Deleting..." : "Delete All GCS Files"}
      </button>
    </div>
  );
}
