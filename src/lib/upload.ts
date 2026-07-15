export interface UploadOptions {
  url: string;
  formData: FormData;
  onProgress: (percent: number) => void;
  onSuccess: (data: any) => void;
  onError: (err: any) => void;
  onAbort?: () => void;
}

export function uploadFileWithProgress(options: UploadOptions) {
  const xhr = new XMLHttpRequest();

  xhr.open('POST', options.url, true);

  // Track upload progress
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percentComplete = Math.round((event.loaded / event.total) * 100);
      options.onProgress(percentComplete);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const response = JSON.parse(xhr.responseText);
        options.onSuccess(response);
      } catch (e) {
        options.onSuccess(xhr.responseText);
      }
    } else {
      options.onError(new Error(`Upload failed with status ${xhr.status}`));
    }
  };

  xhr.onerror = () => {
    options.onError(new Error('Network error occurred during upload.'));
  };

  xhr.onabort = () => {
    if (options.onAbort) options.onAbort();
  };

  xhr.send(options.formData);

  return {
    abort: () => xhr.abort()
  };
}
