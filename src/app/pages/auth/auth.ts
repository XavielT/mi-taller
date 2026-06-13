import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { trigger, transition, style, animate, query, group, AnimationEvent } from '@angular/animations';

export const fadeAnimation = trigger('fadeAnimation', [
  transition('* <=> *', [
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
      })
    ], { optional: true }),
    group([
      query(':leave', [
        style({ zIndex: 0 }),
        animate('250ms ease-out', style({ opacity: 0 }))
      ], { optional: true }),
      query(':enter', [
        style({ opacity: 0, zIndex: 1 }),
        animate('250ms ease-in', style({ opacity: 1 }))
      ], { optional: true }),
    ])
  ])
]);

@Component({
  selector: 'app-auth',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
  animations: [fadeAnimation]
})
export class Auth {
  @ViewChild('viewContainer') viewContainer!: ElementRef<HTMLDivElement>;

  viewHeight: string | null = null;

  getRouteState(outlet: RouterOutlet) {
    return outlet.isActivated ? outlet.activatedRoute.snapshot.url[0]?.path : null;
  }

  onDeactivate(): void {
    const height = this.viewContainer.nativeElement.offsetHeight;
    if (height > 0) {
      this.viewHeight = `${height}px`;
    }
  }

  onRouteAnimationDone(_event: AnimationEvent): void {
    this.viewHeight = null;
  }
}
