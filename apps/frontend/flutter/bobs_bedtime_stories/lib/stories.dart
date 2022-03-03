import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class Stories extends HookWidget {
  const Stories({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.teal,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: const <Widget>[
            Text('Stories', textScaleFactor: 2),
          ],
        ),
      ),
    );
  }
}
