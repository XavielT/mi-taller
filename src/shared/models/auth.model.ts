import { User } from "./user.model";

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    email: string;
    company: string;
    password: string;
}

export interface AuthResponse {
    user: User;
    // In Prodcution the token will be source from HttpOnly Cookie.
}