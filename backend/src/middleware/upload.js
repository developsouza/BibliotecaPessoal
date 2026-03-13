const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

function makeStorage(subfolder) {
    const dest = path.join(__dirname, "../../uploads", subfolder);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, dest),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${uuidv4()}${ext}`);
        },
    });
}

const fileFilter = (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Formato de imagem inválido. Use JPG, PNG ou WebP."), false);
    }
};

const limits = { fileSize: 5 * 1024 * 1024 }; // 5 MB

const upload = multer({ storage: makeStorage("covers"), fileFilter, limits });
upload.avatar = multer({ storage: makeStorage("avatars"), fileFilter, limits });

module.exports = upload;
