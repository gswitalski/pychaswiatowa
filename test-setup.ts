import 'zone.js';
import 'zone.js/testing';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { getTestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Rozszerz expect o matchery z @testing-library/jest-dom
expect.extend(matchers);

// Inicjalizacja środowiska testowego Angular dla Vitest
getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
);

