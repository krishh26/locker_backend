import nodemailer from 'nodemailer'
import smtpTransport from "nodemailer-smtp-transport";

export const SendEmailTemplet = async (email: string | undefined, subject: string, from?: any, body?: any, attachments?: any) => {
    try {
        const transporter = nodemailer.createTransport(
            smtpTransport({
                host: "stmp.gmail.com",
                port: 587,
                service: "gmail",
                requireTLS: true,
                auth: {
                    type: "OAuth2",
                    user: process.env.SMPT_MAIL,
                    pass: process.env.SMPT_PASSWORD,
                    clientId: process.env.MAILCLIENT_ID,
                    clientSecret: process.env.MAILCLIENT_SECRET,
                    refreshToken: process.env.MAILREFRESH_TOKEN
                },
            })
        );
        const mailConfigurations = {
            from: process.env.SMPT_MAIL,
            to: email,
            subject: subject,
            html: body,
        };

        transporter.sendMail(mailConfigurations, function (error, info) {
            if (!info) {
                console.log(error);

            }

            return info?.messageId
        })
    } catch (error) {
        console.log(error)
    }
}