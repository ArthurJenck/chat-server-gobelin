import type { InputHTMLAttributes } from "react";
import "./DottedInput.css";

type DottedInputProps = InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    label?: string;
    hint?: string;
    invalid?: boolean;
};

export default function DottedInput({
    id,
    label,
    hint,
    invalid,
    ...props
}: DottedInputProps) {
    return (
        <div className="dotted-input-field">
            {(label || hint) && (
                <div className="dotted-input-copy">
                    {label && <label htmlFor={id}>{label}</label>}
                    {hint && <span className="dotted-input-hint">{hint}</span>}
                </div>
            )}
            <input id={id} aria-invalid={invalid || undefined} {...props} />
        </div>
    );
}
