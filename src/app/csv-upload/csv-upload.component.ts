import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime } from 'rxjs';
import * as XLSX from 'xlsx';
import { FileNameInputDialogComponent } from './file-name-input-dialog/file-name-input-dialog.component';

@Component({
  selector: 'app-csv-upload',
  templateUrl: './csv-upload.component.html',
  styleUrls: ['./csv-upload.component.css']
})
export class CsvUploadComponent implements OnInit {
  caregiverTotalHoursMap: Map<string, number> = new Map<string, number>();
  caregiverIndex: string = ''
  importedFileName: string = '';
  allPatients: Patient[] = [];
  patients: Patient[] = [];
  caregivers: Caregiver[] = [];

  searchQuery = '';
  searchQueryChanged = new Subject<string>();

  constructor(private dialog: MatDialog) {
    this.searchQueryChanged.pipe(debounceTime(500)).subscribe(() => {
      if (this.searchQuery) {

        this.patients = this.allPatients.filter(p =>
          p.id.toLowerCase().includes(this.searchQuery)
          || p.patientName.toLowerCase().includes(this.searchQuery)
          || p.visits.some(v =>
            v.assignmentId.toLowerCase().includes(this.searchQuery)
            || v.caregiverName.toLowerCase().includes(this.searchQuery)
            || v.contractName.toLowerCase().includes(this.searchQuery)
            || v.coordinatorName.toLowerCase().includes(this.searchQuery)
          )
        )
      } else {
        this.patients = this.allPatients;
      }

    });

  }

  ngOnInit(): void {
  }

  changed() {
    this.searchQueryChanged.next('');
  }



  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    this.importedFileName = file.name;
    this.readFile(file);
  }

  readFile(file: File) {
    const reader: FileReader = new FileReader();
    reader.onload = (e: any) => {
      const contents: string = e.target.result;


      this.parseCSV(contents);
    };
    reader.readAsText(file);
  }

  parseCSV(contents: string) {
    let rows: any[] = contents.split('\n');
    rows.shift();
    rows = rows.map(x => x.split(','));
    rows = rows.map(x => ({
      id: x[0],
      patientId: x[1],
      patientName: x[2],
      coordinatorName: x[3],
      contractName: x[4],
      caregiverName: x[5],
      assignmentId: x[6],
      date: x[7],
      visitScheduled: x[8],
      actualVisit: x[9],
      billed: x[10],
    } as Row))

    let result = rows.reduce(function (r, a) {
      r[a.patientId] = r[a.patientId] || [];
      r[a.patientId].push(a);
      return r;
    }, Object.create(null));

    const caregiverTotalHoursMap: Map<string, number> = new Map<string, number>();

    this.patients = [];
    let totalScheduledHours = 0;
    let cumulativeScheduledHours = 0;
    let sumTotalBillableHours = 0;
    for (var prop in result) {
      if (Object.prototype.hasOwnProperty.call(result, prop)) {
        if (prop == '' || prop == 'undefined') {
          continue;

        } else {
          let group = result[prop];
          const caregiverNames = Array.from(new Set(this.allPatients.flatMap(patient => patient.visits.map(visit => visit.caregiverName))));

          this.caregivers = caregiverNames.map(caregiverName => {
            const caregiverVisits = this.allPatients.flatMap(patient => patient.visits.filter(visit => visit.caregiverName === caregiverName));
            const totalHours = caregiverVisits.reduce((total, visit) => {
              if (visit.actualVisitStart && visit.actualVisitEnd) {
                const hoursDiff = this.getActualVisitTimeDifferenceInHours(
                  visit.actualVisitStart,
                  visit.actualVisitEnd,
                  visit.visitScheduledStart,
                  visit.visitScheduledEnd
                );
                return total + hoursDiff;
              }
              return total;
            }, 0);

            return {
              name: caregiverName,
              visits: caregiverVisits,
              totalHours: totalHours
            } as Caregiver;
          });

          let patient: Patient = {
            id: prop,
            patientName: '',
            cargivers: [],
            visits: this.getVisits(group),
            scheduledHours: 0,
            billableHours: 0,
            totalScheduledHours: 0,
            cumulativeScheduledHours: 0,
            sumTotalBillableHours: 0,
          }
          patient.patientName = patient.visits[0]?.patientName;
          patient.scheduledHours = patient.visits.map(x => x.visitScheduledHourDiffrence).reduce((partialSum, a) => partialSum + a, 0);
          patient.billableHours = patient.visits
            .filter(x => x.validation.missedOut == false && x.validation.missedIn == false && x.billed == false)
            .map(x => x.actualVisitHourDiffrence)
            .reduce((partialSum, a) => partialSum + a, 0);

          patient.totalScheduledHours = patient.scheduledHours;
          totalScheduledHours += patient.scheduledHours;


          patient.cumulativeScheduledHours = patient.scheduledHours + cumulativeScheduledHours;
          cumulativeScheduledHours = patient.cumulativeScheduledHours;



          patient.sumTotalBillableHours += patient.billableHours + sumTotalBillableHours
          sumTotalBillableHours = patient.sumTotalBillableHours;

          this.patients.push(patient);



          group.forEach((visit: Row) => {
            const caregiverName = visit.caregiverName;
            const visitObject = patient.visits.find(v => v.id === visit.id);
            if (visitObject && caregiverName) {
              const actualVisitHourDiff = visitObject.actualVisitHourDiffrence;
              if (this.caregiverTotalHoursMap.has(caregiverName)) {
                this.caregiverTotalHoursMap.set(caregiverName, this.caregiverTotalHoursMap.get(caregiverName)! + actualVisitHourDiff);
              } else {
                this.caregiverTotalHoursMap.set(caregiverName, actualVisitHourDiff);
              }
            }
          });
        }
      }
    }

    this.patients.forEach(patient => {
      patient.totalScheduledHours = totalScheduledHours;
    });


    this.allPatients = this.patients;

    console.log(this.patients);

  }

  getVisits(rows: Row[]): Visit[] {

    let visits: Visit[] = [];
    let caregiverOrderNumbers: Map<string, number> = new Map<string, number>();

    rows.forEach(x => {
      let date = new Date(x.date);
      let visitScheduledStart = this.getStartTime(new Date(date), x.visitScheduled);
      let visitScheduledEnd = this.getEndTime(new Date(date), x.visitScheduled, visitScheduledStart);
      let visitScheduledHourDiffrence = this.getTimeDiffrenceInHours(visitScheduledStart, visitScheduledEnd);
      let actualVisitStart = this.getStartTime(new Date(date), x.actualVisit);
      let actualVisitEnd = this.getEndTime(new Date(date), x.actualVisit, actualVisitStart);
      let actualVisitHourDiffrence = this.getActualVisitTimeDifferenceInHours(actualVisitStart, actualVisitEnd, new Date(visitScheduledStart as Date), new Date(visitScheduledEnd as Date));

      let caregiverName = x.caregiverName;

      if (!caregiverOrderNumbers.has(caregiverName)) {
        caregiverOrderNumbers.set(caregiverName, 1);
      }

      let caregiverOrderNumber = caregiverOrderNumbers.get(caregiverName) || 1;
      caregiverOrderNumbers.set(caregiverName, caregiverOrderNumber + 1);



      let visit: Visit = {
        id: x.id,
        patientId: x.patientId,
        patientName: x.patientName,
        caregiverName: x.caregiverName,
        assignmentId: x.assignmentId,
        billed: x.billed.toLowerCase().includes('yes') ? true : false,
        contractName: x.contractName,
        coordinatorName: x.coordinatorName,
        date: date,
        actualVisitStart: actualVisitStart,
        actualVisitEnd: actualVisitEnd,
        actualVisitHourDiffrence: actualVisitHourDiffrence,
        visitScheduledStart: visitScheduledStart,
        visitScheduledEnd: visitScheduledEnd,
        visitScheduledHourDiffrence: visitScheduledHourDiffrence,
        notes: [],
        validation: {
          earlyIn: 0,
          earlyOut: 0,
          lateIn: 0,
          lateOut: 0,
          missedIn: false,
          missedOut: false,
          color: ''
        },
        orderNumber: caregiverOrderNumber
      }
      this.getNotes(visit);
      visits.push(visit);

    });

    return visits;

  }

  exportVisitsToExcel() {
    const rows: Row[] = this.allPatients.flatMap(patient => patient.visits.map(visit => ({
      id: visit.id,
      patientId: patient.id,
      patientName: visit.patientName,
      coordinatorName: visit.coordinatorName,
      contractName: visit.contractName,
      caregiverName: visit.caregiverName,
      assignmentId: visit.assignmentId,
      date: visit.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      visitScheduled: visit.visitScheduledStart?.toLocaleTimeString() ?? '',
      visitScheduledEnd: visit.visitScheduledEnd?.toLocaleTimeString() ?? '',
      actualVisit: visit.actualVisitStart?.toLocaleTimeString() ?? '',
      actualVisitEnd: visit.actualVisitEnd?.toLocaleTimeString() ?? '',
      Work_Hours: visit.actualVisitHourDiffrence,
      totalHours: visit.visitScheduledHourDiffrence,
      NoteForTotalHours: visit.actualVisitHourDiffrence !== visit.visitScheduledHourDiffrence ? 'Not Matching' : '',
      totalBillableHours: `${patient.billableHours}/${patient.scheduledHours}`,
      caregiver: visit.caregiverName,
      // !add caregiver total hours
      billed: visit.billed ? 'yes' : 'no',
      notes: visit.notes.join(', '),
      attendance: (visit.validation.missedIn ? 'Missed In' : '') + (visit.validation.missedOut ? (visit.validation.missedIn ? 'Missed Out' : 'Missed Out') : ''),

    })));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(rows);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };

    const dialogRef = this.dialog.open(FileNameInputDialogComponent, {
      width: '600px',
      position: { top: '90px' }
    });

    dialogRef.afterClosed().subscribe(fileName => {
      if (!fileName) {
        return;
      }

      const trimmedFileName = fileName.trim();

      if (trimmedFileName === '') {
        return;
      }

      const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${trimmedFileName}.xlsx`;
      anchor.click();

      window.URL.revokeObjectURL(url);
    });
  }
  clearFile() {
    this.importedFileName = '';
    this.allPatients = [];
    this.patients = [];
    this.caregivers = [];

    const fileInput: HTMLInputElement | null = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // calculateCaregiverHours(visits: Visit[]) {
  //   const caregiverNames = Array.from(new Set(visits.map(x => x.caregiverName)));

  //   this.caregivers = caregiverNames.map(caregiverName => {
  //     const caregiverVisits = visits.filter(x => x.caregiverName === caregiverName);
  //     const totalHours = caregiverVisits.reduce((total, visit) => {
  //       if (visit.actualVisitStart && visit.actualVisitEnd) {
  //         const hoursDiff = this.getActualVisitTimeDifferenceInHours(
  //           visit.actualVisitStart,
  //           visit.actualVisitEnd,
  //           visit.visitScheduledStart,
  //           visit.visitScheduledEnd
  //         );
  //         return total + hoursDiff;
  //       }
  //       return total;
  //     }, 0);

  //     return {
  //       name: caregiverName,
  //       visits: caregiverVisits,
  //       totalHours: totalHours
  //     } as Caregiver;
  //   });
  // }



  get totalTotalBillableHours(): number {
    return this.patients.reduce((total, patient) => total + patient.billableHours, 0);
  }


  getStartTime(date: Date, time: string): Date | undefined {
    let array = time.split('-');
    let value = array[0];
    if (value && value != '' || value != null && value.length == 4) {
      date.setHours(parseInt(value.slice(0, 2)));
      date.setMinutes(parseInt(value.slice(2, 4)));
      return date;
    } else {
      return undefined;
    }
  }

  getEndTime(date: Date, time: string, start?: Date): Date | undefined {
    let array = time.split('-');
    let value = array[1];
    if (value && value != '' || value != null && value.length == 4) {
      date.setHours(parseInt(value.slice(0, 2)));
      date.setMinutes(parseInt(value.slice(2, 4)));
      if (start && start > date) {
        date.setDate(date.getDate() + 1)
      }
      return date;
    } else {
      return undefined;
    }
  }

  getTimeDiffrenceInHours(start: Date | undefined, end: Date | undefined): number {
    if (start && end && end > start) {
      return ((end as any) - (start as any)) / 3600000;
    }
    return 0;
  }


  getActualVisitTimeDifferenceInHours(
    actualStart: Date | undefined,
    actualEnd: Date | undefined,
    scheduledStart: Date | undefined,
    scheduledEnd: Date | undefined
  ): number {
    if (!actualStart || !scheduledStart) {
      return 0;
    }

    let quarters = 0;
    // let lateInInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
    // let earlyOutInMinutes = ((scheduledEnd as any) - (actualEnd as any)) / 60000;

    if (actualStart > scheduledStart) {
      if (scheduledEnd && actualEnd && actualEnd > scheduledEnd) {
        let lateInInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
        let lateOutInMinutes = ((actualEnd as any) - (scheduledEnd as any)) / 60000;
        let lateInLateOutDifInMin = Math.abs(lateOutInMinutes - lateInInMinutes);
        if (lateInLateOutDifInMin > 7) {
          quarters = Math.ceil(lateInLateOutDifInMin / 15);
          scheduledStart = new Date(scheduledStart.getTime() + quarters * 15 * 60000);
        }
      } else if (scheduledEnd && actualEnd && scheduledEnd > actualEnd) {
        let lateInInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
        let earlyOutInMinutes = ((scheduledEnd as any) - (actualEnd as any)) / 60000;
        let lateInEarlyOut = Math.abs(lateInInMinutes + earlyOutInMinutes);
        console.log("lateInEarlyOut:", lateInEarlyOut);
        if (lateInEarlyOut > 7) {
          quarters = Math.ceil(lateInEarlyOut / 15);
          scheduledStart = new Date(scheduledStart.getTime() - quarters * 15 * 60000);

        }
      }
    }

    if (scheduledEnd && scheduledEnd > scheduledStart) {
      let value = ((scheduledEnd as any) - (scheduledStart as any)) / 3600000;
      return value;
    }

    return 0;
  }






  // ! under development offical method 20/sep/2023
  getActualVisitTimeDifferenceInHourssa(
    actualStart: Date | undefined,
    actualEnd: Date | undefined,
    scheduledStart: Date | undefined,
    scheduledEnd: Date | undefined): number {
    if (!actualStart || !scheduledStart) {
      return 0;
    }

    let quarters = 0;
    let startDifInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
    let lateInInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
    let earlyOutInMinutes = ((scheduledEnd as any) - (actualEnd as any)) / 60000;
    let lateOutInMinutes = ((actualEnd as any) - (scheduledEnd as any)) / 60000;
    // let lateInInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
    // let earlyOutInMinutes = ((scheduledEnd as any) - (actualEnd as any)) / 60000;
    let lateInEarlyOut = Math.abs(lateInInMinutes + earlyOutInMinutes);
    let scheduledHours = ((scheduledEnd as any) - (scheduledStart as any)) / 60000;
    let workedHours = ((actualEnd as any) - (actualStart as any)) / 60000;
    let differenceHours = scheduledHours - workedHours;


    // late in
    // if ((lateInInMinutes > 7) && !(actualEnd > scheduledEnd) && !(actualEnd < scheduledEnd)) {
    //   quarters = Math.ceil(lateInInMinutes / 15);
    //   scheduledStart = new Date(scheduledStart.getTime() + quarters * 15 * 60000);
    // }

    // late in - on time

    // if ((actualStart > scheduledStart) && ((scheduledEnd == actualEnd) || (lateOutInMinutes < 7) || earlyOutInMinutes < 7)) {
    // if ((actualStart > scheduledStart) && (scheduledEnd == actualEnd)) {
    //   // let lateInInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
    //   if (lateInInMinutes > 7) {
    //     quarters = Math.ceil(lateInInMinutes / 15);
    //     scheduledStart = new Date(scheduledStart.getTime() + quarters * 15 * 60000);
    //   }
    // }
    // ! worked ..late in - late out 
    if ((actualStart > scheduledStart) && (scheduledEnd && actualEnd && actualEnd > scheduledEnd)) {
      let lateInInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;
      let lateOutInMinutes = ((actualEnd as any) - (scheduledEnd as any)) / 60000;
      let lateInLateOutDifInMin = Math.abs(lateOutInMinutes - lateInInMinutes);
      if (lateInLateOutDifInMin > 7) {
        quarters = Math.ceil(lateInLateOutDifInMin / 15);
        scheduledStart = new Date(scheduledStart.getTime() + quarters * 15 * 60000);
      }
    }
    // late in - early out
    if ((actualStart > scheduledStart) && (scheduledEnd && actualEnd && scheduledEnd > actualEnd)) {
      let lateInEarlyOut = Math.abs(lateInInMinutes + earlyOutInMinutes);
      if (lateInEarlyOut > 7) {
        quarters = Math.ceil(lateInEarlyOut / 15);
        scheduledStart = new Date(scheduledStart.getTime() - quarters * 15 * 60000);
      }
    }

    // if ((scheduledStart > actualStart) && (scheduledEnd! > actualEnd!)) {
    //   let differenceHours = scheduledHours - workedHours;
    //   if (differenceHours > 7) {
    //     quarters = Math.ceil(differenceHours / 15);
    //     scheduledStart = new Date(scheduledStart!.getTime() - quarters * 15 * 60000);
    //   }
    // }

    // if (earlyOutInMinutes > 7) {
    //   quarters = Math.ceil(earlyOutInMinutes / 15);
    //   scheduledEnd = new Date(scheduledEnd!.getTime() - quarters * 15 * 60000);
    // }

    if (scheduledEnd && scheduledEnd > scheduledStart) {
      let value = ((scheduledEnd as any) - (scheduledStart as any)) / 3600000;
      return value;
    }

    return 0;
  }

  // ! offical method
  // getActualVisitTimeDifferenceInHours(
  //   actualStart: Date | undefined,
  //   actualEnd: Date | undefined,
  //   scheduledStart: Date | undefined,
  //   scheduledEnd: Date | undefined): number {
  //   if (!actualStart || !scheduledStart) {
  //     return 0;
  //   }

  //   let quarters = 0;
  //   let startDifInMinutes = ((actualStart as any) - (scheduledStart as any)) / 60000;

  //   if (startDifInMinutes > 7) {
  //     quarters = Math.ceil(startDifInMinutes / 15);
  //     scheduledStart = new Date(scheduledStart.getTime() + quarters * 15 * 60000);
  //   }

  //   if (actualEnd && scheduledEnd && actualEnd < scheduledEnd) {
  //     let endDifInMinutes = ((scheduledEnd as any) - (actualEnd as any)) / 60000;

  //   if (endDifInMinutes > 7) {
  //     quarters = Math.ceil(endDifInMinutes / 15);
  //     scheduledEnd = new Date(scheduledEnd.getTime() - quarters * 15 * 60000);
  //   }
  // }

  //   if (scheduledEnd && scheduledEnd > scheduledStart) {
  //     let value = ((scheduledEnd as any) - (scheduledStart as any)) / 3600000;
  //     return value;
  //   }

  //   return 0;
  // }



  getTimeDiffrenceInMinutes(start: Date | undefined, end?: Date): number {
    if (start && end) {
      let value = ((start as any) - (end as any)) / 60000;
      console.log(value);
      return value;

    }
    return 0;
  }

  getNotes(visit: Visit) {
    let notes: string[] = [];
    let validation: Validation = {
      earlyIn: 0,
      earlyOut: 0,
      lateIn: 0,
      lateOut: 0,
      missedIn: false,
      missedOut: false,
      color: '',
    };
    if (visit.billed) {
      notes.push('Already billed');
      validation.color = 'mediumaquamarine';
    }

    if (!visit.actualVisitStart) {
      validation.missedIn = true;
      notes.push('Missed in');
      validation.color = 'mistyrose';
    }

    if (!visit.actualVisitEnd) {
      validation.missedOut = true;
      notes.push('Missed out');
      validation.color = 'mistyrose';
    }

    if (visit.actualVisitStart && visit.actualVisitEnd) {
      let startTimeDiff = this.getTimeDiffrenceInMinutes(new Date(visit.visitScheduledStart as Date), new Date(visit.actualVisitStart as Date));
      let endTimeDiff = this.getTimeDiffrenceInMinutes(new Date(visit.visitScheduledEnd as Date), new Date(visit.actualVisitEnd as Date));

      if (startTimeDiff > 0) {
        validation.earlyIn = startTimeDiff;
        if (Math.abs(startTimeDiff) >= 60) {
          const hours = Math.floor(startTimeDiff / 60);
          const minutes = startTimeDiff % 60;
          notes.push(`Early in by ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`);
        } else {
          notes.push('Early in by ' + startTimeDiff + ' minute' + (startTimeDiff > 1 ? 's' : ''));
        }
        validation.color = validation.color === 'mistyrose' ? 'mistyrose' : 'lightgoldenrodyellow';

      }

      else if (startTimeDiff < 0) {
        validation.lateIn = startTimeDiff;
        if (Math.abs(startTimeDiff) >= 60) {
          const hours = Math.floor(Math.abs(startTimeDiff) / 60);
          const minutes = Math.abs(startTimeDiff) % 60;
          notes.push(`Late in by ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`);
        } else {
          notes.push('Late in by ' + Math.abs(startTimeDiff) + ' minute' + (Math.abs(startTimeDiff) > 1 ? 's' : ''));
        }


        if (Math.abs(startTimeDiff) > 7) {
          validation.color = 'mistyrose';
        } else {
          validation.color = validation.color === 'mistyrose' ? 'mistyrose' : 'lightgoldenrodyellow';
        }
      }

      if (endTimeDiff > 0) {
        validation.earlyOut = endTimeDiff;
        if (Math.abs(endTimeDiff) >= 60) {
          const hours = Math.floor(endTimeDiff / 60);
          const minutes = endTimeDiff % 60;
          notes.push(`Early out by ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`);
        } else {
          notes.push('Early out by ' + endTimeDiff + ' minute' + (endTimeDiff > 1 ? 's' : ''));
        }
        if (Math.abs(endTimeDiff) > 7) {
          validation.color = 'mistyrose';
        } else {
          validation.color = validation.color === 'mistyrose' ? 'mistyrose' : 'lightgoldenrodyellow';
        }
      }

      else if (endTimeDiff < 0) {
        validation.lateOut = endTimeDiff;
        if (Math.abs(endTimeDiff) >= 60) {
          const hours = Math.floor(Math.abs(endTimeDiff) / 60);
          const minutes = Math.abs(endTimeDiff) % 60;
          notes.push(`Late out by ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`);
        } else {
          notes.push('Late out by ' + Math.abs(endTimeDiff) + ' minute' + (Math.abs(endTimeDiff) > 1 ? 's' : ''));
        }
        validation.color = validation.color === 'mistyrose' ? 'mistyrose' : 'lightgoldenrodyellow'; // this i think fix the bugs 
      }
    }

    if (validation.lateIn > 7 && validation.earlyIn > 0 && validation.lateOut > 0) {
      validation.color = 'mistyrose';
    }
    if (validation.earlyOut > 7 && validation.lateOut > 0 && validation.earlyIn > 0) {
      validation.color = 'mistyrose';
    }

    if (validation.lateIn > 7 && validation.earlyOut > 7 || validation.earlyOut > 7 && validation.lateIn > 7) {
      validation.color = 'mistyrose';
    }
    // if (validation.earlyOut >= 7 && validation.lateIn >= 7) {
    //   validation.color = 'mistyrose';
    // }


    visit.validation = validation;
    visit.notes = notes;
  }

}

export interface Row {
  id: string;
  patientId: string;
  patientName: string;
  coordinatorName: string;
  contractName: string;
  caregiverName: string;
  assignmentId: string;
  date: string;
  visitScheduled: string;
  actualVisit: string;
  billed: string;
}



export interface Patient {
  id: string;
  patientName: string;
  scheduledHours: number;
  billableHours: number;
  totalScheduledHours: number;
  cumulativeScheduledHours: number;
  sumTotalBillableHours: number;
  visits: Visit[];
  cargivers: Caregiver[];

}



export interface Visit {
  id: string;
  patientId: string;
  patientName: string;
  coordinatorName: string;
  contractName: string;
  caregiverName: string;
  assignmentId: string;
  date: Date;
  visitScheduledStart: Date | undefined;
  visitScheduledEnd: Date | undefined;
  visitScheduledHourDiffrence: number;
  actualVisitStart: Date | undefined;
  actualVisitEnd?: Date | undefined;
  actualVisitHourDiffrence: number;
  notes: string[];
  billed: boolean;
  validation: Validation;
  orderNumber: number;
}

export interface Caregiver {
  visits: Visit[];
  name: string;
  totalHours: number;
}

export interface Validation {
  lateIn: number;
  lateOut: number;
  earlyIn: number;
  earlyOut: number;
  missedIn: boolean;
  missedOut: boolean;
  color: string;
}

