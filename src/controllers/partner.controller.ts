import { Request, Response } from "express";
import { SendEmailTemplet } from '../util/nodemailer';

class PartnerController {
    public async partnerInquiry(req: Request, res: Response) {
        try {
            const { firstName, lastName, email, phone } = req.body;

            if (!firstName || !lastName || !email || !phone) {
                return res.status(400).json({
                    success: false,
                    message: "All fields are required",
                });
            }

            const subject = "New Partner Inquiry";

            const emailHTML = `
      <div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>New Partner Inquiry Received</h2>

      <p><strong>First Name:</strong> ${firstName}</p>
      <p><strong>Last Name:</strong> ${lastName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone Number:</strong> ${phone}</p>

      <hr/>

      <p>Please contact this person regarding partnership opportunities.</p>
    </div>
    `;

            await SendEmailTemplet(
                process.env.ADMIN_EMAIL,   // send to admin
                subject,
                null,
                emailHTML
            );

            return res.status(200).json({
                success: true,
                message: "Inquiry sent successfully",
            });

        } catch (error) {
            console.log("Partner Inquiry Error:", error);

            return res.status(500).json({
                success: false,
                message: "Something went wrong",
            });
        }
    }
}

export default PartnerController;