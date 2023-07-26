import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileNameInputDialogComponent } from './file-name-input-dialog.component';

describe('FileNameInputDialogComponent', () => {
  let component: FileNameInputDialogComponent;
  let fixture: ComponentFixture<FileNameInputDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FileNameInputDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileNameInputDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
