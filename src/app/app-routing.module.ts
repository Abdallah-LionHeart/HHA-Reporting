import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CalculatorComponent } from './calculator/calculator.component';
import { CsvUploadComponent } from './csv-upload/csv-upload.component';



const routes: Routes = [
  { path: '', component: CsvUploadComponent },
  { path: 'import', component: CsvUploadComponent },
  { path: 'calculator', component: CalculatorComponent },

]



@NgModule({
  declarations: [

  ],
  imports: [
    CommonModule,
    RouterModule.forRoot(routes)
  ],
  exports: [
    RouterModule
  ],
})
export class AppRoutingModule { }
