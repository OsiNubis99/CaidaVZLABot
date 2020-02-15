/**
 * MIT License
 * 
 * Copyright (c) 2019 Andres David Hurtado Fernandez
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/** This object has all Chants available in the game */
class Chants {
  int ronda;
  int chiguire;
  int patrulla;
  int vigia;
  int registro;
  int maguaro;
  int registrico;
  int chica;
  int grande;
  int trivilin;

  /** Set a value to all Chants */
  Chants(int ronda, int chiguire, int patrulla, int vigia, int registro,
      int maguaro, int registrico, int chica, int grande, int trivilin) {
    this.ronda = ronda;
    this.chiguire = chiguire;
    this.patrulla = patrulla;
    this.vigia = vigia;
    this.registro = registro;
    this.maguaro = maguaro;
    this.registrico = registrico;
    this.chica = chica;
    this.grande = grande;
    this.trivilin = trivilin;
  }
}
