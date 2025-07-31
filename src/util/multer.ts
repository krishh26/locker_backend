import multer from 'multer';
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

export const singleFileUpload = (fieldName) => {
    return upload.single(fieldName);
};

export const multipleFileUpload = (fieldName, maxCount) => {
    return upload.array(fieldName, maxCount);
};

export const dynamicFileUpload = () => {
    return upload.any(); // Accepts any files from any fields
};
