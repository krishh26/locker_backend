import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Resource } from '../entity/Resource.entity';
import { CustomRequest } from '../util/Interface/expressInterface';
import { User } from '../entity/User.entity';
import { ResourceStatus } from '../entity/ResourceStatus.entity';
import { uploadMultipleFilesToS3, uploadToS3 } from '../util/aws';

class FileController {


    public async uploadSingleFile(req: CustomRequest, res: Response) {
        try {
            const { folder } = req.body;

            if (!req.file) {
                return res.status(400).json({
                    message: "File Required",
                    status: false
                });
            }

            const file = await uploadToS3(req.file, folder);

            return res.status(200).json({
                message: 'File upload successfully',
                status: true,
                data: file
            });
        } catch (error) {
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    public async uploadMultipleFile(req: CustomRequest, res: Response) {
        try {
            const { folder } = req.body;
            if (!req.files) {
                return res.status(400).json({
                    message: "File Required",
                    status: false
                });
            }

            const files = await uploadMultipleFilesToS3(req.files, folder);

            return res.status(200).json({
                message: 'Files upload successfully',
                status: true,
                data: files
            });
        } catch (error) {
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    public async getFile(req: any, res: Response) {
        try {
            const response = await fetch(req.query.file as string);

            if (!response.ok) {
                throw new Error('Failed to fetch file');
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
            res.send(buffer);
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}
export default FileController;
