import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AiCreditsIndicatorComponent } from '../../../shared/components/ai-credits-indicator/ai-credits-indicator.component';
import { CameraCaptureButtonComponent } from '../../../shared/components/camera-capture-button/camera-capture-button.component';
import { RecipeAssistUrlInputComponent } from '../recipe-new-assist/components/recipe-assist-url-input/recipe-assist-url-input.component';
import { RecipeNewAssistPageComponent } from '../recipe-new-assist/recipe-new-assist-page.component';

@Component({
    selector: 'pych-recipe-variant-ai-assist-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        PageHeaderComponent,
        AiCreditsIndicatorComponent,
        CameraCaptureButtonComponent,
        RecipeAssistUrlInputComponent,
    ],
    templateUrl: '../recipe-new-assist/recipe-new-assist-page.component.html',
    styleUrl: '../recipe-new-assist/recipe-new-assist-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeVariantAiAssistPageComponent extends RecipeNewAssistPageComponent {}
