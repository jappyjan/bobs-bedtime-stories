import 'package:bobs_bedtime_stories/stories.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import './navigation.dart';

void main() {
  runApp(const BobsApp());
}

class BobsApp extends HookWidget {
  const BobsApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final activeTab = useState<int>(0);

    return MaterialApp(
      home: Scaffold(
          bottomNavigationBar: BobsNavigation(activeTab: activeTab),
          body: Builder(),
      ),
    );
  }
}
