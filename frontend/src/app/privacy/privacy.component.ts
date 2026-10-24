import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <main class="card">
        <h1>Privacy Policy</h1>
        <p class="updated">Last updated: October 23, 2026</p>

        <p>Dream Chat is a free website for asking questions about dreams and sleep. This page explains, in plain language, what information the site keeps and why.</p>

        <h2>Chatting as a guest</h2>
        <p>If you never sign in, the site does not ask for or store your name, email, or account details. Your messages are sent to the AI service that produces the answers, and basic rate limit counters are kept for a short time to prevent abuse.</p>

        <h2>If you create an account</h2>
        <p>An account is only an email address, plus either a password (stored as a one way hash, never in plain text) or a Google sign in (Google confirms your email to us; we never see your Google password). That is all an account holds. There is no username and no profile.</p>

        <h2>Saved conversations</h2>
        <p>When you are signed in, the conversations you save are stored with your account so you can reopen them later. You can rename, archive, or delete any saved conversation at any time from the sidebar, and deleting a conversation removes it from our database. Saved conversations are private to your account and are not shared with other visitors.</p>

        <h2>Cookies</h2>
        <p>The site uses one cookie to keep you signed in. It does not carry advertising or tracking data.</p>

        <h2>What we do not do</h2>
        <p>We do not sell your information. We do not share your email or your saved conversations with advertisers or data brokers.</p>

        <h2>Deleting your account</h2>
        <p>To delete your account and everything saved with it, email hello&#64;phoenixwebsites.ai from the address on the account and ask for account deletion.</p>

        <h2>Questions</h2>
        <p>Contact: hello&#64;phoenixwebsites.ai.</p>

        <p><a routerLink="/home">Back to Dream Chat</a></p>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; background: linear-gradient(180deg, #050510 0%, #0a0a24 45%, #12102e 100%); color: #e8e6ff; padding: 2.5rem 1rem 3rem; font-family: Inter, system-ui, sans-serif; }
    .card { max-width: 720px; margin: 0 auto; background: rgba(16, 14, 40, 0.82); border: 1px solid rgba(139, 124, 255, 0.35); border-radius: 20px; padding: 1.6rem 1.5rem; line-height: 1.65; }
    h1 { margin: 0 0 0.2rem; font-size: 1.9rem; }
    h2 { margin: 1.4rem 0 0.4rem; font-size: 1.15rem; color: #c3ccff; }
    p { margin: 0.4rem 0; color: #d8d6f5; }
    .updated { color: #9d97d8; font-size: 0.88rem; }
    a { color: #a5b4ff; }
  `]
})
export class PrivacyComponent {}
