import 'package:flutter/material.dart';

class NowPlaying extends StatelessWidget {
  const NowPlaying({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 200,
      color: Colors.deepPurple,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: const <Widget>[
            Text('Der Buchtitle', textScaleFactor: 2),
            Text('Episode 1', textScaleFactor: 1.2)
          ],
        ),
      ),
    );
  }
}
