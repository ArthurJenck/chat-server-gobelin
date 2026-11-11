import type { ButtonHTMLAttributes } from "react";
import "./DottedButton.css";

type DottedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    iconSrc?: string;
};

export default function DottedButton({
    children,
    iconSrc,
    type = "button",
    className,
    ...props
}: DottedButtonProps) {
    return (
        <button
            {...props}
            type={type}
            className={className ? `dotted-button ${className}` : "dotted-button"}
        >
            {children}
            {iconSrc && <img src={iconSrc} alt="" aria-hidden="true" />}
        </button>
    );
}
