// Global state
let uploadedImages = [];
let processedImages = [];
let modelsLoaded = false;

// DOM elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const imagesGrid = document.getElementById("imagesGrid");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const status = document.getElementById("status");
const cropMarginInput = document.getElementById("cropMargin");
const cropMarginValue = document.getElementById("cropMarginValue");
const scaleWidthInput = document.getElementById("scaleWidth");
const scaleHeightInput = document.getElementById("scaleHeight");
const maintainAspectInput = document.getElementById("maintainAspect");

// Initialize
async function init() {
  showStatus("Loading face detection models...", "loading");
  try {
    // Load face-api.js models from CDN
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    showStatus("Ready! Upload images to get started.", "success");
    setTimeout(() => hideStatus(), 3000);
  } catch (error) {
    console.error("Error loading models:", error);
    showStatus(
      "Warning: Face detection may not work. Proceeding without it.",
      "error",
    );
    modelsLoaded = false;
  }
}

// Status messages
function showStatus(message, type = "loading") {
  status.textContent = message;
  status.className = `status show ${type}`;
}

function hideStatus() {
  status.className = "status";
}

// Event listeners
cropMarginInput.addEventListener("input", (e) => {
  cropMarginValue.textContent = e.target.value;
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const files = Array.from(e.dataTransfer.files).filter((file) =>
    file.type.startsWith("image/"),
  );
  handleFiles(files);
});

dropZone.addEventListener("click", (e) => {
  // Only trigger file input if clicking on the drop zone itself, not when it's triggered from button
  if (e.target === dropZone || e.target.closest(".drop-zone") === dropZone) {
    fileInput.click();
  }
});

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  handleFiles(files);
});

processBtn.addEventListener("click", processImages);
downloadBtn.addEventListener("click", downloadAll);
clearBtn.addEventListener("click", clearAll);

// Handle file uploads
function handleFiles(files) {
  if (files.length === 0) return;

  showStatus(`Loading ${files.length} image(s)...`, "loading");

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        uploadedImages.push({
          name: file.name,
          file: file,
          image: img,
          src: e.target.result,
        });
        displayImage(img, file.name, "original");

        if (uploadedImages.length === files.length) {
          showStatus(
            `${files.length} image(s) loaded. Click "Process Images" to start.`,
            "success",
          );
          processBtn.disabled = false;
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Display image in grid
function displayImage(img, name, type, faces = 0) {
  const card = document.createElement("div");
  card.className = "image-card";

  // Add staggered animation delay
  const cardIndex = imagesGrid.children.length;
  card.style.animationDelay = `${cardIndex * 0.1}s`;

  const wrapper = document.createElement("div");
  wrapper.className = "image-wrapper";

  const displayImg = document.createElement("img");
  displayImg.src = img.src;
  wrapper.appendChild(displayImg);

  const info = document.createElement("div");
  info.className = "image-info";

  const title = document.createElement("h4");
  title.textContent = name;

  const dimensions = document.createElement("p");
  dimensions.textContent = `${img.width} × ${img.height}px`;

  const badge = document.createElement("span");
  badge.className = `badge ${type}`;
  badge.textContent =
    type === "original"
      ? "Original"
      : faces > 0
        ? `Processed (${faces} face${faces > 1 ? "s" : ""})`
        : "No faces detected";

  info.appendChild(title);
  info.appendChild(dimensions);
  info.appendChild(badge);

  card.appendChild(wrapper);
  card.appendChild(info);
  imagesGrid.appendChild(card);
}

// Process images
async function processImages() {
  if (uploadedImages.length === 0) return;

  processBtn.disabled = true;
  processedImages = [];
  imagesGrid.innerHTML = "";

  const cropMargin = parseInt(cropMarginInput.value);
  const targetWidth = parseInt(scaleWidthInput.value);
  const targetHeight = parseInt(scaleHeightInput.value);
  const maintainAspect = maintainAspectInput.checked;

  for (let i = 0; i < uploadedImages.length; i++) {
    const imgData = uploadedImages[i];
    showStatus(
      `Processing ${i + 1}/${uploadedImages.length}: ${imgData.name}`,
      "loading",
    );

    try {
      let detections = [];

      if (modelsLoaded) {
        // Detect faces
        detections = await faceapi.detectAllFaces(imgData.image);
      }

      // Create canvas for processing
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let processedImg;
      let facesFound = detections.length;

      if (detections.length > 0) {
        // Calculate bounding box for all faces
        let minX = Infinity,
          minY = Infinity,
          maxX = 0,
          maxY = 0;

        detections.forEach((detection) => {
          const box = detection.box;
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        });

        // Add margin
        minX = Math.max(0, minX - cropMargin);
        minY = Math.max(0, minY - cropMargin);
        maxX = Math.min(imgData.image.width, maxX + cropMargin);
        maxY = Math.min(imgData.image.height, maxY + cropMargin);

        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;

        // Crop image
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.drawImage(
          imgData.image,
          minX,
          minY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight,
        );

        // Scale
        processedImg = await scaleImage(
          canvas,
          targetWidth,
          targetHeight,
          maintainAspect,
        );
      } else {
        // No faces, just scale the original
        canvas.width = imgData.image.width;
        canvas.height = imgData.image.height;
        ctx.drawImage(imgData.image, 0, 0);
        processedImg = await scaleImage(
          canvas,
          targetWidth,
          targetHeight,
          maintainAspect,
        );
      }

      processedImages.push({
        name: imgData.name,
        image: processedImg,
        faces: facesFound,
      });

      displayImage(processedImg, imgData.name, "processed", facesFound);
    } catch (error) {
      console.error(`Error processing ${imgData.name}:`, error);
      showStatus(`Error processing ${imgData.name}`, "error");
    }
  }

  showStatus(
    `Successfully processed ${processedImages.length} image(s)!`,
    "success",
  );
  downloadBtn.style.display = "inline-block";
  processBtn.disabled = false;
}

// Scale image
function scaleImage(canvas, targetWidth, targetHeight, maintainAspect) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scaledCanvas = document.createElement("canvas");
      const ctx = scaledCanvas.getContext("2d");

      if (maintainAspect) {
        const aspectRatio = img.width / img.height;
        if (img.width > img.height) {
          scaledCanvas.width = targetWidth;
          scaledCanvas.height = targetWidth / aspectRatio;
        } else {
          scaledCanvas.height = targetHeight;
          scaledCanvas.width = targetHeight * aspectRatio;
        }
      } else {
        scaledCanvas.width = targetWidth;
        scaledCanvas.height = targetHeight;
      }

      ctx.drawImage(img, 0, 0, scaledCanvas.width, scaledCanvas.height);

      const scaledImg = new Image();
      scaledImg.src = scaledCanvas.toDataURL("image/png");
      scaledImg.onload = () => resolve(scaledImg);
    };
    img.src = canvas.toDataURL("image/png");
  });
}

// Download all processed images
async function downloadAll() {
  if (processedImages.length === 0) return;

  showStatus("Preparing download...", "loading");

  try {
    const zip = new JSZip();
    const folder = zip.folder("processed-images");

    processedImages.forEach((imgData, index) => {
      const base64Data = imgData.image.src.split(",")[1];
      const fileName = imgData.name.replace(/\.[^/.]+$/, "") + "_processed.png";
      folder.file(fileName, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "processed-images.zip";
    a.click();
    URL.revokeObjectURL(url);

    showStatus("Download complete!", "success");
    setTimeout(() => hideStatus(), 3000);
  } catch (error) {
    console.error("Error creating zip:", error);
    showStatus("Error creating download", "error");
  }
}

// Clear all
function clearAll() {
  uploadedImages = [];
  processedImages = [];
  imagesGrid.innerHTML = "";
  downloadBtn.style.display = "none";
  processBtn.disabled = true;
  fileInput.value = "";
  hideStatus();
}

// Start the app
init();
