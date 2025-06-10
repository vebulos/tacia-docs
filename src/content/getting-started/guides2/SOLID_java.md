### **SOLID-Prinzipien in Java – einfach erklärt mit Beispielen**  

SOLID ist ein **Akronym für 5 Design-Prinzipien**, die helfen, sauberen, wartbaren und erweiterbaren Code zu schreiben. Hier eine **praxisnahe Erklärung** mit Java-Beispielen:

---

## **1. S – Single Responsibility (Eine Aufgabe pro Klasse)**  
> *"Eine Klasse sollte nur **einen Grund zur Änderung** haben."*  

❌ **Schlecht:**  
```java
class User {
    void saveToDatabase() { /* ... */ }
    void sendEmail() { /* ... */ }
    void validate() { /* ... */ }
}
```  
**Problem:** Die Klasse `User` kümmert sich um Logik, Persistenz *und* E-Mails → schwer wartbar.  

✅ **Gut:**  
```java
class User { /* Nur Daten */ }

class UserRepository { void save(User user) { /* ... */ } }

class EmailService { void sendEmail(User user) { /* ... */ } }

class UserValidator { boolean isValid(User user) { /* ... */ } }
```  
**Vorteil:** Jede Klasse hat **eine klare Aufgabe**.  

---

## **2. O – Open-Closed (Offen für Erweiterung, geschlossen für Modifikation)**  
> *"Klassen sollten **erweiterbar sein**, ohne den bestehenden Code zu ändern."*  

❌ **Schlecht:**  
```java
class AreaCalculator {
    double calculate(Object shape) {
        if (shape instanceof Circle) { /* Kreis-Logik */ }
        else if (shape instanceof Square) { /* Quadrat-Logik */ }
        // Bei neuen Formen muss die Methode geändert werden!
    }
}
```  

✅ **Gut (mit Polymorphismus):**  
```java
interface Shape { double area(); }

class Circle implements Shape { 
    @Override public double area() { /* ... */ } 
}

class Square implements Shape { 
    @Override public double area() { /* ... */ } 
}

// Neue Formen können hinzugefügt werden, ohne AreaCalculator zu ändern!
```  

---

## **3. L – Liskov Substitution (Ersetzbarkeit durch Subklassen)**  
> *"Subklassen sollten **ihre Elternklasse ersetzen** können, ohne das Verhalten zu brechen."*  

❌ **Schlecht:**  
```java
class Bird {
    void fly() { /* ... */ }
}

class Penguin extends Bird { 
    @Override void fly() { throw new UnsupportedOperationException(); } 
    // Pinguine können nicht fliegen → Verletzt LSP!
}
```  

✅ **Gut:**  
```java
class Bird { /* Basisklasse */ }

class FlyingBird extends Bird { void fly() { /* ... */ } }

class Penguin extends Bird { /* Keine fly()-Methode! */ }
```  

---

## **4. I – Interface Segregation (Kleine, spezifische Interfaces)**  
> *"Clients sollten nicht von Interfaces abhängen, die sie nicht brauchen."*  

❌ **Schlecht:**  
```java
interface Worker {
    void work();
    void eat(); // Nicht jeder "Worker" muss essen können!
}

class Robot implements Worker {
    @Override void work() { /* ... */ }
    @Override void eat() { /* Unnötig! */ } // Robot muss essen?!
}
```  

✅ **Gut:**  
```java
interface Workable { void work(); }
interface Eatable { void eat(); }

class Human implements Workable, Eatable { /* ... */ }
class Robot implements Workable { /* ... */ } // Kein "eat()" nötig!
```  

---

## **5. D – Dependency Inversion (Abhängigkeiten von Abstraktionen)**  
> *"High-Level-Module sollten nicht von Low-Level-Modulen abhängen, sondern von **Abstraktionen**."*  

❌ **Schlecht:**  
```java
class LightBulb {
    void turnOn() { /* ... */ }
}

class Switch {
    private LightBulb bulb; // Direkte Abhängigkeit von LightBulb!
    void operate() { bulb.turnOn(); }
}
```  

✅ **Gut (mit Dependency Injection):**  
```java
interface Switchable { void turnOn(); }

class LightBulb implements Switchable { 
    @Override public void turnOn() { /* ... */ } 
}

class Switch {
    private Switchable device; // Abhängigkeit vom Interface!
    Switch(Switchable device) { this.device = device; } // DI!
    void operate() { device.turnOn(); }
}
```  
**Vorteil:** `Switch` kann nun **beliebige** `Switchable`-Geräte steuern (z. B. auch `Fan`).  

---

### **Zusammenfassung der SOLID-Prinzipien**  
| Prinzip                      | Kurzregel                                  | Beispiel-Java-Code |  
|------------------------------|-------------------------------------------|--------------------|  
| **Single Responsibility**    | Eine Klasse = eine Aufgabe.               | [Beispiel](#1-s-single-responsibility-eine-aufgabe-pro-klasse) |  
| **Open-Closed**              | Erweitern, nicht ändern.                  | [Beispiel](#2-o-open-closed-offen-für-erweiterung-geschlossen-für-modifikation) |  
| **Liskov Substitution**      | Subklassen sollten Eltern ersetzen können. | [Beispiel](#3-l-liskov-substitution-ersetzbarkeit-durch-subklassen) |  
| **Interface Segregation**    | Keine überflüssigen Methoden in Interfaces. | [Beispiel](#4-i-interface-segregation-kleine-spezifische-interfaces) |  
| **Dependency Inversion**     | Abhängigkeiten von Abstraktionen, nicht Implementierungen. | [Beispiel](#5-d-dependency-inversion-abhängigkeiten-von-abstraktionen) |  

Diese Prinzipien machen Code **flexibler, testbarer und wartbarer** – besonders in großen Projekten! 🚀  

**Frage:** Möchtest du ein konkretes Beispiel vertiefen? 😊