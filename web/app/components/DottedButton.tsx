import type { ButtonHTMLAttributes } from "react";
import EmphasizedText from "./EmphasizedText";
import "./DottedButton.css";

type DottedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    iconSrc?: string;
    emphasized?: boolean;
};

export default function DottedButton({
    children,
    iconSrc,
    emphasized = false,
    type = "button",
    className,
    ...props
}: DottedButtonProps) {
    return (
        <button
            {...props}
            type={type}
            className={
                className ? `dotted-button ${className}` : "dotted-button"
            }
        >
            <span className="dotted-button-content">
                {emphasized && typeof children === "string" ? (
                    <EmphasizedText>{children}</EmphasizedText>
                ) : (
                    children
                )}
                {iconSrc && (
                    <span className="dotted-button-icon">
                        {emphasized && (
                            <img
                                className="dotted-button-icon-blur"
                                src={iconSrc}
                                alt=""
                                aria-hidden="true"
                            />
                        )}
                        <img
                            className="dotted-button-icon-face"
                            src={iconSrc}
                            alt=""
                            aria-hidden="true"
                        />
                    </span>
                )}
            </span>
        </button>
    );
}
