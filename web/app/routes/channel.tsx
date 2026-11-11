import { Link, useParams } from "react-router";
import PageHeader from "../components/PageHeader";
import { useAccount } from "../features/auth/useAccount";
import MessageItem from "../features/chat/MessageItem";
import { useChannelChat } from "../features/chat/useChannelChat";
import KeyControl from "../features/key/KeyControl";
import { PATHS } from "../shared/config";

export default function ChannelPage() {
    const { channelId } = useParams();
    const id = Number(channelId);
    const {
        account,
        loading: accountLoading,
        error: accountError,
    } = useAccount();
    const {
        channel,
        messages,
        keyChannelId,
        keyState,
        content,
        setContent,
        busy,
        keyBusy,
        error,
        submit,
        toggleKey,
    } = useChannelChat(id, account);

    if (!accountLoading && account && !channel)
        return (
            <main>
                <p>Groupe introuvable.</p>
                <Link to={PATHS.home}>Retour</Link>
            </main>
        );

    return (
        <main className="chat-page">
            <PageHeader title={channel?.name ?? "Groupe"} back={PATHS.home} />
            {account && keyChannelId !== null && (
                <KeyControl
                    state={keyState}
                    userId={account.id}
                    busy={keyBusy}
                    onChange={() => void toggleKey()}
                />
            )}
            {(accountLoading ||
                (channel && keyChannelId === null && !error)) && (
                <p>Chargement des messages…</p>
            )}
            {(accountError || error) && (
                <p role="alert">{accountError || error}</p>
            )}
            <section aria-labelledby="messages-heading">
                <h2 id="messages-heading">Messages</h2>
                {messages.length ? (
                    <ol>
                        {[...messages].reverse().map((message, index) => (
                            <MessageItem
                                key={
                                    message.id ??
                                    `${message.creation_date}-${message.user_id}-${index}`
                                }
                                message={message}
                                hasKey={keyState.holderId === message.user_id}
                            />
                        ))}
                    </ol>
                ) : (
                    keyChannelId !== null && <p>Aucun message.</p>
                )}
            </section>
            {channel && (
                <form onSubmit={(event) => void submit(event)}>
                    <label htmlFor="message-content">Message</label>
                    <textarea
                        id="message-content"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        disabled={
                            !content.trim() || busy || keyChannelId === null
                        }
                    >
                        Envoyer
                    </button>
                </form>
            )}
        </main>
    );
}
