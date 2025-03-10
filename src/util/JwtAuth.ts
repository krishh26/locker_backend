import jwt from 'jsonwebtoken';

const secret: string = process.env.SECRET_KEY

export const generateToken = (payload, expiration = '20d'): any => {

    return jwt.sign(payload, secret, { expiresIn: expiration });
};

export const verifyToken = (token: string): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        await jwt.verify(token, secret, (err: any, decoded: any) => {
            if (err) {
                reject(err);
            } else {
                resolve(decoded);
            }
        });
    });
}