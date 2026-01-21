import { Component, ChangeDetectionStrategy, input, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-indicator',
  imports: [CommonModule],
  template: `
    <div 
      class="flex flex-col items-center justify-center gap-4"
      [class.py-8]="size() === 'large'"
      [class.py-4]="size() === 'small'"
    >
      <div class="relative" 
          [class.w-24]="size() === 'large'" [class.h-24]="size() === 'large'"
          [class.w-16]="size() === 'small'" [class.h-16]="size() === 'small'">
        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" [attr.r]="radius" stroke="currentColor" stroke-width="10" class="text-sky-100"/>
          <circle 
            cx="50" cy="50" [attr.r]="radius" 
            stroke="currentColor" stroke-width="10" stroke-linecap="round"
            class="text-sky-500"
            [style.stroke-dasharray]="circumference()"
            [style.stroke-dashoffset]="strokeDashoffset()"
            style="transition: stroke-dashoffset 0.1s linear;"
          />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span 
            class="font-black text-sky-600 tabular-nums"
            [class.text-xl]="size() === 'large'"
            [class.text-base]="size() === 'small'"
          >
            {{ flooredPercentage() }}<span class="text-xs">%</span>
          </span>
        </div>
      </div>
      @if (message()) {
        <p class="text-xs font-semibold text-slate-500">{{ message() }}</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingIndicatorComponent implements OnInit, OnDestroy {
  message = input<string>('Memproses data...');
  size = input<'large' | 'small'>('large');
  /** Estimated duration in milliseconds for the progress to reach 100%. */
  estimatedDuration = input<number>(4000);
  
  percentage = signal(0);
  flooredPercentage = computed(() => Math.floor(this.percentage() || 0));
  private startTime!: number;
  private animationFrameId?: number;

  // SVG properties
  readonly radius = 45;
  readonly circumference = computed(() => 2 * Math.PI * this.radius);
  readonly strokeDashoffset = computed(() => this.circumference() * (1 - (this.percentage() || 0) / 100));

  ngOnInit(): void {
    this.startTime = Date.now();
    this.tick();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private tick(): void {
    const elapsedTime = Date.now() - this.startTime;
    const progress = Math.min(100, (elapsedTime / this.estimatedDuration()) * 100);
    this.percentage.set(progress);

    if (progress < 100) {
      this.animationFrameId = requestAnimationFrame(() => this.tick());
    }
  }
}
