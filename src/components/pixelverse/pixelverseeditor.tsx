import React, { useState } from "react";
import Balance from "./balance.js";

// --- Pixelverse API Calls ---

interface PixelverseEditorProps {
  apiKey: string;
  onVideoGenerated?: (videoUrl: string) => void;
  onImageUpload?: (imageUrl: string) => void;
  prompt?: string;
  onPromptChange?: (prompt: string) => void;
  negative_prompt?: string;
  onNegativePromptChange?: (negative_prompt: string) => void;
  template_id?: string;
  onTemplateIdChange?: (template_id: string) => void;
  seed?: number;
  onSeedChange?: (seed: number) => void;
}

export function PixelverseEditor({
  apiKey,
  onVideoGenerated,
  prompt,
  negative_prompt,
  template_id,
  seed,
}: PixelverseEditorProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
      handleUploadProcess();
    }
  };

  const handleRegenerate = () => {
  };

  const handleUploadProcess = async () => {
    
  };

  return (
    <div>
      <Balance apiKey={apiKey} />
      {videoStatus === 0 && !selectedFile && (
        <div>
          <p>Drag/Drop or Click HERE to upload</p>
          <input
            title="Upload Image"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
          />
        </div>
      )}
      {loading && <div>Loading...</div>}
      {videoStatus === 0 && selectedFile && (
        <button onClick={handleUploadProcess}>Start Upload</button>
      )}
      {videoStatus === 1 && (
        <div>
          <video src={videoUrl} controls />
          <button onClick={handleRegenerate}>Regenerate</button>
        </div>
      )}
    </div>
  );
}
