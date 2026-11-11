import type { FormEventHandler } from "react";
import DottedButton from "./DottedButton";
import DottedInput from "./DottedInput";
import EmphasizedText from "./EmphasizedText";
import "./AuthForm.css";

type AuthFormProps = {
    mode: "login" | "register";
    username: string;
    password: string;
    confirmation?: string;
    busy: boolean;
    error?: boolean;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onConfirmationChange?: (value: string) => void;
    onSubmit: FormEventHandler<HTMLFormElement>;
};

export default function AuthForm({
    mode,
    username,
    password,
    confirmation,
    busy,
    error = false,
    onUsernameChange,
    onPasswordChange,
    onConfirmationChange,
    onSubmit,
}: AuthFormProps) {
    const isRegister = mode === "register";

    return (
        <form className={`auth-form auth-form-${mode}`} onSubmit={onSubmit}>
            <div className="auth-fields">
                <DottedInput
                    id={`${mode}-username`}
                    label="Nom d’utilisateur :"
                    hint={isRegister ? "Ton nom ne pourra plus être changé" : undefined}
                    autoComplete="username"
                    placeholder="tutur_legoat"
                    value={username}
                    invalid={error}
                    aria-describedby={error ? "login-error" : undefined}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    required
                />
                <div className="auth-password-group">
                    <DottedInput
                        id={`${mode}-password`}
                        label="Mot de passe :"
                        type="password"
                        autoComplete={isRegister ? "new-password" : "current-password"}
                        placeholder="*****"
                        value={password}
                        invalid={error}
                        aria-describedby={error ? "login-error" : undefined}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        required
                    />
                    {!isRegister && (
                        <span className="auth-forgot">
                            <EmphasizedText>J’ai oublié mon mot de passe</EmphasizedText>
                        </span>
                    )}
                </div>
                {isRegister ? (
                    <DottedInput
                        id="register-confirmation"
                        label="Confirmer le mot de passe :"
                        type="password"
                        autoComplete="new-password"
                        placeholder="*****"
                        value={confirmation ?? ""}
                        onChange={(event) => onConfirmationChange?.(event.target.value)}
                        required
                    />
                ) : null}
            </div>
            <DottedButton
                className="auth-submit"
                iconSrc="/pictos/arrow.svg"
                emphasized
                type="submit"
                disabled={
                    busy || !username.trim() || !password || (isRegister && !confirmation)
                }
            >
                Continuer
            </DottedButton>
        </form>
    );
}
