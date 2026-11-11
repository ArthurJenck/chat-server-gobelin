import "./EmphasizedText.css";

export default function EmphasizedText({ children }: { children: string }) {
    return (
        <span className="emphasized-text" data-text={children}>
            <span className="emphasized-text-face">{children}</span>
        </span>
    );
}
