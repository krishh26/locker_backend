import nodemailer from 'nodemailer';
import smtpTransport from "nodemailer-smtp-transport";

export const SendCalendarInvite = async (email: string, subject: string, body: string, icalContent: string) => {
    try {
        const transporter = nodemailer.createTransport(
            smtpTransport({
                host: "smtp.gmail.com",
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

        const mailOptions = {
            from: process.env.SMPT_MAIL,
            to: email,
            subject: subject,
            text: body,
            alternatives: [{
                contentType: 'text/calendar; method=REQUEST',
                content: Buffer.from(icalContent)
            }],
            attachments: [{
                filename: 'invite.ics',
                content: icalContent,
                contentType: 'text/calendar; charset=utf-8; method=REQUEST'
            }]
        };

        return new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Calendar invite send error:', error);
                    reject(error);
                } else {
                    console.log('Calendar invite sent:', info.messageId);
                    resolve(info);
                }
            });
        });
    } catch (error) {
        console.log('Calendar invite error:', error);
        throw error;
    }
};

export const SendEmailTemplet = async (email: string | undefined, subject: string, from?: any, body?: any, attachments?: any) => {
    try {
        const transporter = nodemailer.createTransport(
            smtpTransport({
                host: "smtp.gmail.com",
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
        const mailConfigurations: any = {
            from: process.env.SMPT_MAIL,
            to: email,
            subject: subject,
        };

        // Check if body contains HTML tags, if not treat as plain text
        if (body && body.includes('<')) {
            mailConfigurations.html = body;
        } else {
            mailConfigurations.text = body;
        }

        // Handle calendar invitations specially
        if (attachments && attachments.length > 0) {
            const calendarAttachment = attachments.find(att => att.contentType === 'text/calendar');

            if (calendarAttachment) {
                // For calendar invitations, set the content as the main email content
                mailConfigurations.icalEvent = {
                    filename: 'invite.ics',
                    method: 'REQUEST',
                    content: calendarAttachment.content
                };

                // Also add as alternative content
                mailConfigurations.alternatives = [{
                    contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
                    content: calendarAttachment.content
                }];

                // Keep other attachments
                const otherAttachments = attachments.filter(att => att.contentType !== 'text/calendar');
                if (otherAttachments.length > 0) {
                    mailConfigurations.attachments = otherAttachments;
                }
            } else {
                mailConfigurations.attachments = attachments;
            }
        }

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