import { Routes } from '@angular/router';
import { Access } from './access';
import { Login } from './login';
import { Error } from './error';
import { Register } from './register';
import { ForgotPassword } from './forgotpassword';
import { NewPassword } from './newpassword';
import { Verification } from './verification';
import { LockScreen } from './lockscreen';
import { SessionConflictError } from './session.conflict.error';
import { ResetPasswordPageComponent } from '@/app/Auth/reset-password/reset-password.component';
import { ForgotPasswordComponent } from '@/app/Auth/forgot-password/forgot-password.component';
import { LoginComponent } from '@/app/Auth/login/login.component';

export default [
    { path: 'access', component: Access },
    { path: 'error', component: Error },
    { path: 'login', component: Login },
    { path: 'register', component: Register },
    { path: 'forgotpassword', component: ForgotPassword },
    { path: 'newpassword', component: NewPassword },
    { path: 'verification', component: Verification },
    { path: 'lockscreen', component: LockScreen },
    { path: 'session-conflict', component: SessionConflictError },
    { path: 'reset-password', component: ResetPasswordPageComponent },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'login', component: LoginComponent },
] as Routes;
