import { Component, signal, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

interface Msg { role: 'user' | 'assistant'; content: string; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements AfterViewChecked {
  private api = inject(ApiService);
  @ViewChild('scrollBox') private scrollBox?: ElementRef<HTMLDivElement>;

  protected messages = signal<Msg[]>([
    { role: 'assistant', content: 'Welcome to Dream Chat. Tell me a dream you remember, ask how to lucid dream, or pick a topic below. I answer from a large library of dream science, firsthand accounts, traditions, and declassified Gateway material, and I keep those sources labeled so you can tell them apart.' }
  ]);
  protected draft = signal('');
  protected sending = signal(false);
  protected notice = signal('');

  protected chips = [
    'Interpret my dream',
    'How do I lucid dream?',
    'What is the Gateway Process?',
    'What is Mall World?'
  ];

  ngAfterViewChecked() {
    const el = this.scrollBox?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

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
      },
      error: (err) => {
        this.sending.set(false);
        const msg = (err && err.error && err.error.error) || 'Something interrupted the dream. Please try again in a moment.';
        this.messages.set([...this.messages(), { role: 'assistant', content: msg }]);
      }
    });
  }
}
