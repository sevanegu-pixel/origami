-keep class ch.origami.boitemail.veille.** { *; }
# WorkManager : sa base Room est créée par réflexion (WorkDatabase_Impl).
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-keep class androidx.work.** { *; }
