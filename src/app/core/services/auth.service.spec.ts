import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { AuthResponse } from '@supabase/supabase-js';
import { SignUpRequestDto } from '../../../../shared/contracts/types';

describe('AuthService', () => {
    let service: AuthService;
    let mockSupabaseService: any;

    // Inicjalizacja środowiska testowego Angular
    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        // Przygotowanie mocka SupabaseService
        mockSupabaseService = {
            auth: {
                signUp: vi.fn(),
                signInWithPassword: vi.fn(),
                signOut: vi.fn(),
                getSession: vi.fn(),
            },
        };

        // Konfiguracja TestBed
        await TestBed.configureTestingModule({
            providers: [
                AuthService,
                { provide: SupabaseService, useValue: mockSupabaseService },
            ],
        }).compileComponents();

        service = TestBed.inject(AuthService);
        vi.clearAllMocks();
    });

    describe('signUp()', () => {
        it('powinien zarejestrować użytkownika z poprawnymi danymi', async () => {
            // Arrange
            const credentials: SignUpRequestDto = {
                email: 'test@example.com',
                password: 'password123',
                options: {
                    data: {
                        displayName: 'Test User',
                    },
                },
            };

            const mockAuthResponse: AuthResponse = {
                data: {
                    user: { id: '123', email: 'test@example.com' } as any,
                    session: { access_token: 'token' } as any,
                },
                error: null,
            };

            mockSupabaseService.auth.signUp.mockResolvedValue(mockAuthResponse);

            // Act
            const result = await service.signUp(credentials);

            // Assert
            expect(result).toEqual(mockAuthResponse);
            expect(mockSupabaseService.auth.signUp).toHaveBeenCalledWith({
                email: credentials.email,
                password: credentials.password,
                options: credentials.options,
            });
            expect(mockSupabaseService.auth.signUp).toHaveBeenCalledTimes(1);
        });

        it('powinien rzucić błąd gdy rejestracja się nie powiedzie', async () => {
            // Arrange
            const credentials: SignUpRequestDto = {
                email: 'test@example.com',
                password: 'password123',
            };

            const mockError = { message: 'User already exists' };
            mockSupabaseService.auth.signUp.mockResolvedValue({
                data: { user: null, session: null },
                error: mockError,
            });

            // Act & Assert
            await expect(service.signUp(credentials)).rejects.toEqual(mockError);
        });
    });

    describe('signIn()', () => {
        it('powinien zalogować użytkownika z poprawnymi danymi', async () => {
            // Arrange
            const email = 'test@example.com';
            const password = 'password123';

            const mockAuthResponse: AuthResponse = {
                data: {
                    user: { id: '123', email } as any,
                    session: { access_token: 'token' } as any,
                },
                error: null,
            };

            mockSupabaseService.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);

            // Act
            const result = await service.signIn(email, password);

            // Assert
            expect(result).toEqual(mockAuthResponse);
            expect(mockSupabaseService.auth.signInWithPassword).toHaveBeenCalledWith({
                email,
                password,
            });
        });

        it('powinien rzucić błąd gdy logowanie się nie powiedzie', async () => {
            // Arrange
            const email = 'test@example.com';
            const password = 'wrongpassword';

            const mockError = { message: 'Invalid credentials' };
            mockSupabaseService.auth.signInWithPassword.mockResolvedValue({
                data: { user: null, session: null },
                error: mockError,
            });

            // Act & Assert
            await expect(service.signIn(email, password)).rejects.toEqual(mockError);
        });
    });

    describe('signOut()', () => {
        it('powinien wylogować użytkownika poprawnie', async () => {
            // Arrange
            mockSupabaseService.auth.signOut.mockResolvedValue({ error: null });

            // Act
            await service.signOut();

            // Assert
            expect(mockSupabaseService.auth.signOut).toHaveBeenCalledTimes(1);
        });

        it('powinien rzucić błąd gdy wylogowanie się nie powiedzie', async () => {
            // Arrange
            const mockError = { message: 'Session expired' };
            mockSupabaseService.auth.signOut.mockResolvedValue({ error: mockError });

            // Act & Assert
            await expect(service.signOut()).rejects.toEqual(mockError);
        });
    });

    describe('getSession()', () => {
        it('powinien zwrócić sesję użytkownika', async () => {
            // Arrange
            const mockSession = {
                data: {
                    session: { access_token: 'token' } as any,
                },
                error: null,
            };

            mockSupabaseService.auth.getSession.mockResolvedValue(mockSession);

            // Act
            const result = await service.getSession();

            // Assert
            expect(result).toEqual(mockSession);
            expect(mockSupabaseService.auth.getSession).toHaveBeenCalledTimes(1);
        });
    });
});

