import { Component, signal, inject, effect, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

interface Msg { role: 'user' | 'assistant'; content: string; }
interface ConvoMeta { id: string; title: string; archived: boolean; updatedAt: string; }

const WELCOME: Msg = {
  role: 'assistant',
  content: 'Welcome to Dream Chat. Tell me a dream you remember, ask how to lucid dream, or pick a topic below. I answer from a large library of dream science, firsthand accounts, traditions, and declassified Gateway material, and I keep those sources labeled so you can tell them apart.'
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements AfterViewChecked {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  @ViewChild('scrollBox') private scrollBox?: ElementRef<HTMLDivElement>;
  @ViewChild('googleBtn') private googleBtn?: ElementRef<HTMLDivElement>;

  protected messages = signal<Msg[]>([WELCOME]);
  protected draft = signal('');
  protected sending = signal(false);
  protected notice = signal('');

  // Conversations
  protected convos = signal<ConvoMeta[]>([]);
  protected archivedConvos = signal<ConvoMeta[]>([]);
  protected currentId = signal<string | null>(null);
  protected showArchived = signal(false);
  protected sidebarOpen = signal(false);
  protected hasUnsaved = signal(false);
  protected savedToast = signal('');
  protected renamingId = signal<string | null>(null);
  protected renameDraft = signal('');
  protected confirmDeleteId = signal<string | null>(null);

  // Auth modal
  protected showAuth = signal(false);
  protected authMode = signal<'login' | 'register'>('register');
  protected authEmail = signal('');
  protected authPassword = signal('');
  protected authError = signal('');
  protected authBusy = signal(false);

  protected chips = [
    'Interpret my dream',
    'How do I lucid dream?',
    'What is the Gateway Process?',
    'What is Mall World?'
  ];

  constructor() {
    this.auth.init();
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.loadConvos();
      } else {
        this.convos.set([]);
        this.archivedConvos.set([]);
        this.currentId.set(null);
      }
    });
  }

  ngAfterViewChecked() {
    const el = this.scrollBox?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // ---------- chat ----------

  useChip(chip: string) {
    if (chip === 'Interpret my dream') {
      this.draft.set('I want help interpreting my dream. Here it is: ');
      return;
    }
    this.draft.set(chip);
    this.send();
  }

  send() {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    const next = [...this.messages(), { role: 'user' as const, content: text }];
    this.messages.set(next);
    this.draft.set('');
    this.sending.set(true);
    this.api.postData<any>('chat', { messages: next }).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res && res.configured === false) this.notice.set('The chat is almost ready: connecting the AI key is the last step.');
        this.messages.set([...this.messages(), { role: 'assistant', content: res.reply || 'I went quiet there. Try again.' }]);
        this.afterExchange();
      },
      error: (err) => {
        this.sending.set(false);
        const msg = (err && err.error && err.error.error) || 'Something interrupted the dream. Please try again in a moment.';
        this.messages.set([...this.messages(), { role: 'assistant', content: msg }]);
      }
    });
  }

  private afterExchange() {
    if (this.auth.user()) {
      this.persist();
    } else if (this.auth.accountsOn()) {
      this.hasUnsaved.set(true);
    }
  }

  // Save the open thread to the account (create on first save, then update).
  private persist() {
    const msgs = this.messages();
    const id = this.currentId();
    if (id) {
      this.api.putData<any>(`conversations/${id}`, { messages: msgs }).subscribe({
        next: () => this.loadConvos(),
        error: () => {}
      });
    } else {
      this.api.postData<any>('conversations', { messages: msgs }).subscribe({
        next: (r) => {
          this.currentId.set(r.id);
          this.loadConvos();
          // The auto title lands a few seconds later; pick it up.
          setTimeout(() => this.loadConvos(), 3500);
        },
        error: () => {}
      });
    }
  }

  // ---------- conversation list ----------

  loadConvos() {
    this.api.getData<any>('conversations').subscribe({
      next: (r) => this.convos.set(r.conversations || []),
      error: () => {}
    });
    if (this.showArchived()) this.loadArchived();
  }

  loadArchived() {
    this.api.getData<any>('conversations?archived=1').subscribe({
      next: (r) => this.archivedConvos.set(r.conversations || []),
      error: () => {}
    });
  }

  toggleArchived() {
    this.showArchived.set(!this.showArchived());
    if (this.showArchived()) this.loadArchived();
  }

  newChat() {
    this.messages.set([WELCOME]);
    this.currentId.set(null);
    this.hasUnsaved.set(false);
    this.notice.set('');
    this.sidebarOpen.set(false);
    this.confirmDeleteId.set(null);
    this.renamingId.set(null);
  }

  openConvo(c: ConvoMeta) {
    this.api.getData<any>(`conversations/${c.id}`).subscribe({
      next: (r) => {
        const msgs: Msg[] = Array.isArray(r.messages) && r.messages.length ? r.messages : [WELCOME];
        this.messages.set(msgs);
        this.currentId.set(c.id);
        this.hasUnsaved.set(false);
        this.sidebarOpen.set(false);
        this.confirmDeleteId.set(null);
        this.renamingId.set(null);
      },
      error: () => this.notice.set('That conversation could not be opened.')
    });
  }

  startRename(c: ConvoMeta) {
    this.renamingId.set(c.id);
    this.renameDraft.set(c.title);
    this.confirmDeleteId.set(null);
  }

  commitRename(c: ConvoMeta) {
    const title = this.renameDraft().trim();
    this.renamingId.set(null);
    if (!title || title === c.title) return;
    this.api.patchData<any>(`conversations/${c.id}`, { title }).subscribe({
      next: () => { this.loadConvos(); this.loadArchived(); },
      error: () => this.notice.set('Rename did not save.')
    });
  }

  archiveConvo(c: ConvoMeta, flag: boolean) {
    this.api.patchData<any>(`conversations/${c.id}`, { archived: flag }).subscribe({
      next: () => { this.loadConvos(); this.loadArchived(); },
      error: () => this.notice.set('That did not save.')
    });
  }

  askDelete(c: ConvoMeta) {
    this.confirmDeleteId.set(this.confirmDeleteId() === c.id ? null : c.id);
    this.renamingId.set(null);
  }

  doDelete(c: ConvoMeta) {
    this.api.deleteData<any>(`conversations/${c.id}`).subscribe({
      next: () => {
        this.confirmDeleteId.set(null);
        if (this.currentId() === c.id) this.newChat();
        this.loadConvos();
        this.loadArchived();
      },
      error: () => this.notice.set('Delete did not work.')
    });
  }

  // ---------- auth ----------

  private renderGoogle() {
    setTimeout(() => {
      if (this.googleBtn?.nativeElement) {
        this.auth.renderGoogleButton(this.googleBtn.nativeElement, (email, error) => {
          if (email) {
            this.showAuth.set(false);
            this.afterSignIn();
          } else if (error) {
            this.authError.set(error);
          }
        });
      }
    }, 60);
  }

  openAuth() {
    this.authError.set('');
    this.showAuth.set(true);
    this.renderGoogle();
  }

  closeAuth() {
    this.showAuth.set(false);
    this.authError.set('');
    this.authPassword.set('');
  }

  switchMode(mode: 'login' | 'register') {
    this.authMode.set(mode);
    this.authError.set('');
    this.renderGoogle();
  }

  submitAuth() {
    const email = this.authEmail().trim();
    const password = this.authPassword();
    if (!email || !password || this.authBusy()) return;
    this.authBusy.set(true);
    this.authError.set('');
    const call = this.authMode() === 'register'
      ? this.auth.register(email, password)
      : this.auth.login(email, password);
    call.subscribe({
      next: () => {
        this.authBusy.set(false);
        this.authPassword.set('');
        this.showAuth.set(false);
        this.afterSignIn();
      },
      error: (err) => {
        this.authBusy.set(false);
        this.authError.set((err && err.error && err.error.error) || 'Something went wrong. Try again.');
      }
    });
  }

  // After any successful sign in: if the guest was mid conversation and
  // wanted it kept, save that thread to the account now.
  private afterSignIn() {
    if (this.hasUnsaved() && !this.currentId() && this.messages().length > 1) {
      this.api.postData<any>('conversations', { messages: this.messages() }).subscribe({
        next: (r) => {
          this.currentId.set(r.id);
          this.hasUnsaved.set(false);
          this.savedToast.set('Conversation saved to your account.');
          this.loadConvos();
          setTimeout(() => this.loadConvos(), 3500);
          setTimeout(() => this.savedToast.set(''), 4000);
        },
        error: () => this.notice.set('Signed in, but saving that conversation did not work.')
      });
    } else {
      this.loadConvos();
    }
  }

  signOut() {
    this.auth.logout();
    this.newChat();
  }
}
