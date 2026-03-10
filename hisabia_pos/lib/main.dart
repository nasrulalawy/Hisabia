import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'services/pos_service.dart';
import 'screens/login_screen.dart';
import 'screens/select_org_screen.dart';
import 'screens/shift_screen.dart';
import 'screens/pos_screen.dart';
import 'screens/scan_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PosService.init();
  runApp(const HisabiaPosApp());
}

class HisabiaPosApp extends StatelessWidget {
  const HisabiaPosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hisabia POS',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
        useMaterial3: true,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const _AuthGate(),
        '/login': (context) => const LoginScreen(),
        '/select_org': (context) => const SelectOrgScreen(),
        '/shift': (context) => const ShiftScreen(),
        '/pos': (context) => const PosScreen(),
        '/scan': (context) => const ScanScreen(),
      },
    );
  }
}

class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  @override
  void initState() {
    super.initState();
    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      if (!mounted) return;
      setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = PosService.currentUser != null;
    if (session) {
      return const SelectOrgScreen();
    }
    return const LoginScreen();
  }
}
