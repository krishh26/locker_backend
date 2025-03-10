import * as bcrypt from 'bcrypt';

export const bcryptpassword = async (Password: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        bcrypt.hash(Password, 10, (err, hash) => {
            if (err) {
                console.error('Error hashing password', err);
                reject(err);
            } else {
                resolve(hash);
            }
        });
    });
};

export const comparepassword = async (Password: string, hashPassword: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        bcrypt.compare(Password, hashPassword, (err, result) => {
            if (err) {
                console.error('Error comparing passwords', err);
                reject(true);
            } else {
                resolve(result);
            }
        });
    });
};

export const generatePassword = () => {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()-_=+[{]}|;:,<.>/?';

    const allChars = uppercaseChars + lowercaseChars + numbers + symbols;

    let password = '';

    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * allChars.length);
        password += allChars[randomIndex];
    }

    return password;
}