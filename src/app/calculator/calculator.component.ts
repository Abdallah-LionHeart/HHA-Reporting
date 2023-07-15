import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css']
})
export class CalculatorComponent implements OnInit {

  form!: FormGroup;
  result: Result | null = null;
  constructor(private fb: FormBuilder) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      totalDays: [{ value: null, disabled: true }],
      workingHours: [null],
      includeEndDate: [false],
    })

    this.form.get('startDate')?.valueChanges.subscribe(startDate => {
      if (startDate && this.form.value.endDate) {
        this.form.patchValue({
          totalDays: this.getTotalDays(new Date(startDate), new Date(this.form.value.endDate), this.form.value.includeEndDate)
        })
      }
    })

    this.form.get('endDate')?.valueChanges.subscribe(endDate => {
      if (this.form.value.startDate && endDate) {
        this.form.patchValue({
          totalDays: this.getTotalDays(new Date(this.form.value.startDate), new Date(endDate), this.form.value.includeEndDate)
        })
      }
    })

    this.form.get('includeEndDate')?.valueChanges.subscribe(includeEndDate => {
      if (this.form.value.startDate && this.form.value.endDate) {
        this.form.patchValue({
          totalDays: this.getTotalDays(new Date(this.form.value.startDate), new Date(this.form.value.endDate), includeEndDate)
        })
      }
    })
  }

  getTotalDays(startDate: Date, endDate: Date, includeLastDay: boolean): number {

    if (includeLastDay) {
      endDate.setDate(endDate.getDate() + 1)
    }

    let days: number = ((endDate as any) - (startDate as any)) / (1000 * 60 * 60 * 24);
    if (days > 0) {
      return days;
    } else {
      return 0;
    }

  }

  calculate() {
    if (this.form.invalid) {
      return
    }
    this.result = null;
    let value = this.form.value;
    let days = this.getTotalDays(new Date(value.startDate), new Date(value.endDate), value.includeEndDate)
    this.result = {
      startDate: new Date(value.startDate),
      endDate: new Date(value.endDate),
      days: days,
      includeLastDay: value.includeEndDate,
      hours: days * 24,
      minutes: days * 24 * 60,
      seconds: days * 24 * 60 * 60,
      weeks: Math.floor(days / 7),
      hasWorkingHours: value.workingHours > 0,
      workingHoursPerDay: value.workingHours > 0 ? (value.workingHours / days) : 0,
      workingHoursPerWeek: value.workingHours > 0 ? (value.workingHours / days) * 7 : 0
    }
  }

}

export interface Result {
  startDate: Date;
  endDate: Date;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  includeLastDay: boolean;
  hasWorkingHours: boolean;
  workingHoursPerDay: number;
  workingHoursPerWeek: number;
}
