const uploadInput = document.getElementById("upload");
const sizeMultiplierInput = document.getElementById("sizeMultiplier");
const bulkPreview = document.getElementById("bulk-preview");
const compressBtn = document.getElementById("compress-btn");
const downloadBtn = document.getElementById("download-btn");
const sliderValue = document.getElementById("sliderValue");
const dropZone = document.getElementById("drop-zone");
const compressionInfo = document.getElementById("compression-info");
const formatSelect = document.getElementById("format-select");
let sizeMultiplier = parseFloat(sizeMultiplierInput.value);
let compressedImages = [];
let originalSizes = {};

sizeMultiplierInput.addEventListener("input", (event) => {
    sizeMultiplier = parseFloat(event.target.value);
    sliderValue.textContent = sizeMultiplier.toFixed(1);
});

function handleFiles(files) {
    bulkPreview.innerHTML = '';
    compressedImages = [];
    originalSizes = {};
    downloadBtn.style.display = "none";
    compressionInfo.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.alt = file.name;
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.appendChild(img);
                bulkPreview.appendChild(div);
                originalSizes[file.name] = file.size;
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = true;
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.appendChild(video);
            bulkPreview.appendChild(div);
            originalSizes[file.name] = file.size;
        }
    }
}

uploadInput.addEventListener("change", (event) => {
    handleFiles(event.target.files);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    uploadInput.files = files;
    handleFiles(files);
});

compressBtn.addEventListener("click", () => {
    const files = uploadInput.files;
    if (files.length === 0) return;

    compressedImages = [];
    let processed = 0;
    compressionInfo.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                compressImage(e.target.result, file.name, () => {
                    processed++;
                    if (processed === files.length) {
                        downloadBtn.style.display = "inline-block";
                    }
                });
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            compressVideo(file, () => {
                processed++;
                if (processed === files.length) {
                    downloadBtn.style.display = "inline-block";
                }
            });
        }
    }
});

function compressImage(imageSrc, fileName, callback) {
    const image = new Image();
    image.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = image.width * sizeMultiplier;
        canvas.height = image.height * sizeMultiplier;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const format = formatSelect.value;
        let compressedDataUrl;
        if (format === 'image/jpeg') {
            compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        } else {
            compressedDataUrl = canvas.toDataURL("image/png");
        }

        const compressedSize = Math.round((compressedDataUrl.length * 3) / 4);
        compressedImages.push({ name: fileName, data: compressedDataUrl, size: compressedSize });

        updateCompressionInfo(fileName, originalSizes[fileName], compressedSize);

        callback();
    };
    image.src = imageSrc;
}

function compressVideo(file, callback) {
    // Ensure ffmpeg.js is loaded
    if (typeof ffmpeg === "undefined") {
        console.error("ffmpeg.js is not loaded. Please include it in your project.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const videoData = e.target.result;
        const videoName = file.name.split('.')[0];
        
        // Set up ffmpeg
        const ffmpeg = new FFmpeg();
        ffmpeg.load().then(() => {
            ffmpeg.FS('writeFile', videoName, new Uint8Array(videoData));
            ffmpeg.run('-i', videoName, '-vf', `scale=iw*${sizeMultiplier}:ih*${sizeMultiplier}`, `compressed_${videoName}.mp4`).then(() => {
                const compressedVideoData = ffmpeg.FS('readFile', `compressed_${videoName}.mp4`);
                const compressedVideoBlob = new Blob([compressedVideoData.buffer], { type: 'video/mp4' });
                const compressedVideoUrl = URL.createObjectURL(compressedVideoBlob);
                const compressedSize = compressedVideoBlob.size;

                compressedImages.push({ name: `compressed_${videoName}.mp4`, data: compressedVideoUrl, size: compressedSize });
                updateCompressionInfo(`compressed_${videoName}.mp4`, originalSizes[file.name], compressedSize);
                callback();
            });
        });
    };
    reader.readAsArrayBuffer(file);
}

function updateCompressionInfo(fileName, originalSize, compressedSize) {
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.innerHTML = `
        <div class="file-name">${fileName}</div>
        <div class="size-info">
            <span>Original: ${formatBytes(originalSize)}</span>
            <span>Compressed: ${formatBytes(compressedSize)}</span>
            <span>Saved: ${compressionRatio}%</span>
        </div>
    `;
    compressionInfo.appendChild(fileInfo);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

downloadBtn.addEventListener("click", () => {
    const format = formatSelect.value;
    const extension = format === 'image/jpeg' ? 'jpg' : 'png';

    if (compressedImages.length === 1) {
        // Download single image or video
        const link = document.createElement("a");
        link.href = compressedImages[0].data;
        link.download = compressedImages[0].name;
        link.click();
    } else {
        // Download multiple images as ZIP
        const zip = new JSZip();
        const folder = zip.folder("compressed-files");

        compressedImages.forEach((img) => {
            const base64Data = img.data.split(',')[1];
            const fileName = img.name;
            folder.file(fileName, base64Data, { base64: true });
        });

        zip.generateAsync({ type: "blob" }).then((content) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "compressed-files.zip";
            link.click();
        });
    }
});
