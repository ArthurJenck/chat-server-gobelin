import { useEffect, useRef, type InputHTMLAttributes } from "react";
import gsap from "gsap";
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
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const input = inputRef.current;
        if (!invalid || !input || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

        const animation = gsap.timeline({
            onComplete: () => gsap.set(input, { clearProps: "transform" }),
        });
        animation
            .to(input, { x: -8, duration: 0.07, ease: "power1.inOut" })
            .to(input, { x: 8, duration: 0.1, repeat: 5, yoyo: true, ease: "power1.inOut" })
            .to(input, { x: 0, duration: 0.07, ease: "power1.inOut" });

        return () => {
            animation.kill();
            gsap.set(input, { clearProps: "transform" });
        };
    }, [invalid]);

    return (
        <div className="dotted-input-field">
            {(label || hint) && (
                <div className="dotted-input-copy">
                    {label && <label htmlFor={id}>{label}</label>}
                    {hint && <span className="dotted-input-hint">{hint}</span>}
                </div>
            )}
            <input ref={inputRef} id={id} aria-invalid={invalid || undefined} {...props} />
        </div>
    );
}
