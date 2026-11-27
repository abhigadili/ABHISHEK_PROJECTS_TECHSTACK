import { ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewChild, forwardRef, inject, input, AfterViewInit } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { sanitizeHtml } from './safe-html.component';

/** Jodit rich-text editor (lazy-loaded) as a form control. Output HTML is sanitised before it reaches the form. */
@Component({
  selector: 'app-rich-text-editor', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorComponent), multi: true }],
  template: `<textarea #host aria-label="Rich text"></textarea>`,
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLTextAreaElement>;
  minHeight = input(160);
  private editor: any; private value = ''; private disabled = false; private onChange: (v: string) => void = () => {}; private onTouched = () => {};
  async ngAfterViewInit() {
    const { Jodit } = await import('jodit');
    this.zone.runOutsideAngular(() => {
      this.editor = Jodit.make(this.host.nativeElement, {
        minHeight: this.minHeight(), height: this.minHeight() + 40, toolbarAdaptive: true, askBeforePasteHTML: false, askBeforePasteFromWord: false, defaultActionOnPaste: 'insert_clear_html',
        buttons: 'bold,italic,underline,|,ul,ol,|,link,|,undo,redo', showCharsCounter: false, showWordsCounter: false, showXPathInStatusbar: false, readonly: this.disabled,
        uploader: { insertImageAsBase64URI: false },
      });
      this.editor.value = this.value;
      this.editor.events.on('change', (v: string) => this.zone.run(() => { this.value = sanitizeHtml(v); this.onChange(this.value); }));
      this.editor.events.on('blur', () => this.zone.run(() => this.onTouched()));
    });
  }
  writeValue(v: string | null) { this.value = v ?? ''; if (this.editor && this.editor.value !== this.value) this.editor.value = this.value; }
  registerOnChange(fn: (v: string) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void) { this.onTouched = fn; }
  setDisabledState(d: boolean) { this.disabled = d; if (this.editor) this.editor.setReadOnly(d); }
  ngOnDestroy() { this.editor?.destruct?.(); }
}
