import { Component, HostListener, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-file-name-input-dialog',
  templateUrl: './file-name-input-dialog.component.html',
  styleUrls: ['./file-name-input-dialog.component.css']
})
export class FileNameInputDialogComponent implements OnInit {

  fileName!: string;

  constructor(
    public dialogRef: MatDialogRef<FileNameInputDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  ngOnInit(): void {
    throw new Error('Method not implemented.');
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  @HostListener('document:keydown.enter')
  onEnterKey(): void {
    if (this.fileName.trim() !== '') {
      this.dialogRef.close(this.fileName);
    }
  }
}