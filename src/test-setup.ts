import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { RouterTestingModule } from '@angular/router/testing';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  [BrowserDynamicTestingModule, RouterTestingModule],
  platformBrowserDynamicTesting(),
  { teardown: { destroyAfterEach: false } }
);
