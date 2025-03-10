import { NextFunction, Request, Response } from "express";
import { UserStatus } from "./constants";

export const userActive = (user) => {
    if (user.status !== UserStatus.Active) {
        throw new Error("This user is Archived");
    }
};


