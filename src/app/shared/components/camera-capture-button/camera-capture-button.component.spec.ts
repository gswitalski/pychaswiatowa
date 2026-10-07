import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraCaptureButtonComponent } from './camera-capture-button.component';

describe('CameraCaptureButtonComponent', () => {
    let fixture: ComponentFixture<CameraCaptureButtonComponent>;
    let component: CameraCaptureButtonComponent;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CameraCaptureButtonComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CameraCaptureButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    function getFileInput(): HTMLInputElement {
        return fixture.nativeElement.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;
    }

    function getButton(): HTMLButtonElement {
        return fixture.nativeElement.querySelector(
            'button'
        ) as HTMLButtonElement;
    }

    it('powinien emitować fileSelected po change z plikiem', () => {
        const fileSelectedSpy = vi.fn();
        component.fileSelected.subscribe(fileSelectedSpy);

        const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
        const input = getFileInput();
        Object.defineProperty(input, 'files', {
            value: [file],
            configurable: true,
        });

        input.dispatchEvent(new Event('change'));
        fixture.detectChanges();

        expect(fileSelectedSpy).toHaveBeenCalledOnce();
        expect(fileSelectedSpy).toHaveBeenCalledWith(file);
    });

    it('nie powinien emitować fileSelected przy pustym files (anulowanie)', () => {
        const fileSelectedSpy = vi.fn();
        component.fileSelected.subscribe(fileSelectedSpy);

        const input = getFileInput();
        input.dispatchEvent(new Event('change'));
        fixture.detectChanges();

        expect(fileSelectedSpy).not.toHaveBeenCalled();
    });

    it('disabled=true blokuje input i button', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        const input = getFileInput();
        const button = getButton();

        expect(input.disabled).toBe(true);
        expect(button.disabled).toBe(true);
    });

    it('klik przycisku wywołuje click na input i stopPropagation', () => {
        const input = getFileInput();
        const clickSpy = vi.spyOn(input, 'click');
        const button = getButton();
        const event = new MouseEvent('click', { bubbles: true });
        const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

        button.dispatchEvent(event);

        expect(stopPropagationSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
    });

    it('nie otwiera pickera gdy disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        const input = getFileInput();
        const clickSpy = vi.spyOn(input, 'click');

        component.onButtonClick(new MouseEvent('click'));

        expect(clickSpy).not.toHaveBeenCalled();
    });
});
